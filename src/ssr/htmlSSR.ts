import { SRayElement } from '../defineElement.js';
import {
  DynamicInterpolators,
  FunctionInterpolator,
  Template,
  bindingRE,
  childrenAnchor,
  getTemplateMetadata,
  isFuncInterpolator,
} from '../html.js';
import { popReactiveContextStack, pushReactiveContextStack } from '../reactive.js';
import { error, isArray, sanitizeHtml } from '../utils.js';
import { customElements } from './customElements.js';

interface Attr {
  type: 'Attribute';
  name: string;
  value: string | null;
}

interface Text {
  type: 'Text';
  content: string;
}

interface Comment {
  type: 'Comment';
  content: string;
}

interface CDATA {
  type: 'CDATA';
  content: string;
}

type Children = (Tag | Text | Comment | CDATA)[];
interface Tag {
  type: 'Element';
  name: string;
  attrs: Attr[];
  children: Children;
  isSelfClosing: boolean;
}

enum BindingType {
  BooleanAttr = 0,
  Property,
  NormalAttr,
  Event,
  Ref,
}

interface BindingObject {
  type: BindingType;
  name: string;
  value: any;
  dynamicPartSpecifiers: string[];
}

interface BooleanAttrBinding extends BindingObject {
  type: BindingType.BooleanAttr;
  value: boolean;
}

interface PropertyBinding extends BindingObject {
  type: BindingType.Property;
  value: unknown;
}

interface NormalAttrBinding extends BindingObject {
  type: BindingType.NormalAttr;
  value: string;
}

interface EventBinding extends BindingObject {
  type: BindingType.Event;
  value: CallableFunction;
}

interface RefBinding extends BindingObject {
  type: BindingType.Ref;
  value: CallableFunction;
}

type Binding = BooleanAttrBinding | PropertyBinding | NormalAttrBinding | EventBinding | RefBinding;

interface AttributesRenderResult {
  str: string;
  bindings: Binding[];
}

export function isSSRTemplate(template: unknown): template is SSRTemplate {
  return template instanceof SSRTemplate;
}

let templateId = 0;
let textWarpperId = 0;

class SSRTemplate {
  #textModes = {
    DATA: 'DATA',
    RCDATA: 'RCDATA',
    RAWTEXT: 'RAWTEXT',
    CDATA: 'CDATA',
  };

  #dynamicPartToGetterMap: Map<string, DynamicInterpolators>;

  #source = '';
  #currentTextMode = this.#textModes.DATA;

  // TODO: stream the chunks
  #chunks: string[] = [];

  constructor(source: string, dynamicPartToGetterMap: Map<string, DynamicInterpolators>) {
    this.#source = source;
    this.#dynamicPartToGetterMap = dynamicPartToGetterMap;
  }

  /**
   * Server render protocols used to hydrate in the client side:
   * 1. For each html`` template, we will generate a heading comment and a trailing comment to mark the start and end of the template, the comment will have the following format:
   *    <!--[id-dId-->...<!--id-dId]-->
   *    The id is a unique number for each template, the dId refers to the dynamicPartSpecifier id, if the dId is not provided, it means that the template is as the shadow root of a custom element
   *    or it is a set of templates that are rendered from an array of templates.
   *    demo: <!--[1-0-->...<!--1-0]-->
   *    deom for the root of the template: <!--[0--->...<!--0-]-->
   * 2. If the template is rendered from an array of templates, e.g. [html``, html``, html``], we will generate a heading comment and a trailing comment to mark the start and end of the array of templates,
   *    the comment will have the following format:
   *    <!--[[id-dId-->... <!--id-dId]]-->
   *    demo:
   *      <!--[[2-0-->
   *        <!--[3--->...<!--3-]-->
   *        <!--[4--->...<!--4-]-->
   *        <!--[5--->...<!--5-]-->
   *      <!--2-0]]-->
   * 3. For attributes, properties(including :prop and ?prop), events, and refs, we will keep their original binding format in the generated html string, e.g.:
   *    <div :style="$$--dynamic0--$$" ?disabled="$$--dynamic1--$$" @click="$$--dynamic2--$$" ref="$$--dynamic3--$$"></div>
   *    but for attributes, we will prefix their name with the '#' symbol, e.g.:
   *    <div #data-foo="$$--dynamic0--$$ bar $$--dynamic1--$$" data-foo="real value"></div>
   * 4. For text bindings, we will wrap the text with the following comment format:
   *    <!--%id-dId-->...<!--id-dId%-->
   */
  toString(dId: string = '') {
    const id = templateId++;
    this.#chunks = [`<!--[${id}-${dId}-->`];
    // TODO: improve this later since there is no need to parse the templates that have the same pattern more than once
    this.parse();
    this.#chunks.push(`<!--${id}-${dId}]-->`);
    return this.#chunks.join('');
  }

  #advanceBy(num: number) {
    this.#source = this.#source.slice(num);
  }

  #advanceSpaces() {
    const match = /^[\t\r\n\f ]+/.exec(this.#source);
    if (match) {
      this.#advanceBy(match[0].length);
    }
  }

  parse() {
    const nodes = this.#parseChildren([]);

    return {
      type: 'Root',
      children: nodes,
    };
  }

  #parseChildren(ancestors: Tag[]) {
    let nodes = [];

    while (!this.#isEnd(ancestors)) {
      let node;

      if (this.#currentTextMode === this.#textModes.DATA || this.#currentTextMode === this.#textModes.RCDATA) {
        if (this.#currentTextMode === this.#textModes.DATA && this.#source[0] === '<') {
          if (this.#source[1] === '!') {
            if (this.#source.startsWith('<!--')) {
              // comments
              node = this.#parseComment();
            } else if (this.#source.startsWith('<![CDATA[')) {
              // CDATA
              node = this.#parseCDATA();
            }
          } else if (this.#source[1] === '/') {
            // end tag
          } else if (/[a-z]/i.test(this.#source[1])) {
            // open tag
            node = this.#parseElement(ancestors);
          }
        }
      }

      if (!node) {
        node = this.#parseText();
      }

      nodes.push(node);
    }

    return nodes;
  }

  #parseElement(ancestors: Tag[]) {
    const element = this.#parseTag();

    if (!element) return null;

    this.#onTagStart(element);

    if (element.isSelfClosing) return element;

    ancestors.push(element);
    if (element.name === 'textarea' || element.name === 'title') {
      this.#currentTextMode = this.#textModes.RCDATA;
    } else if (/style|xmp|iframe|noembed|noframes|noscript/.test(element.name)) {
      this.#currentTextMode = this.#textModes.RAWTEXT;
    } else {
      this.#currentTextMode = this.#textModes.DATA;
    }
    element.children = this.#parseChildren(ancestors);
    ancestors.pop();

    if (this.#source.startsWith(`</${element.name}`)) {
      const endTag = this.#parseTag('end');
      if (endTag) {
        if (endTag.name !== element.name) {
          __ENV__ === 'development' && error(`Expected closing tag for ${element.name} but got ${endTag.name}`);
        }
      }
      this.#onTagEnd(element);
    } else if (__ENV__ === 'development') {
      error(`${element.name} tag is missing closing tag`);
    }

    return element;
  }

  #parseTag(type: 'start' | 'end' = 'start'): Tag | null {
    const match = type === 'start'
      ? /^<([a-z][^\t\r\n\f />]*)/i.exec(this.#source)
      : /^<\/([a-z][^\t\r\n\f />]*)/i.exec(this.#source);

    if (!match) {
      __ENV__ === 'development' && error('Invalid tag');
      return null;
    }

    const tag = match[1];

    this.#advanceBy(match[0].length);
    this.#advanceSpaces();

    const attrs = this.#parseAttributes();

    const isSelfClosing = this.#source.startsWith('/>');
    this.#advanceBy(isSelfClosing ? 2 : 1);

    return {
      type: 'Element',
      name: tag,
      attrs,
      children: [],
      isSelfClosing,
    };
  }

  #parseAttributes(): Attr[] {
    const props: Attr[] = [];

    while (
      !this.#source.startsWith('>') &&
      !this.#source.startsWith('/>')
    ) {
      const match = /^[^\t\r\n\f />][^\t\r\n\f />=]*/.exec(this.#source);
      if (!match) {
        __ENV__ === 'development' && error('Invalid attribute');
        return [];
      }
      const name = match[0];

      this.#advanceBy(name.length);
      this.#advanceSpaces();
      const isEqualSign = this.#source[0] === '=';
      if (!isEqualSign) {
        props.push({
          type: 'Attribute',
          name,
          value: null,
        });
        continue;
      }

      this.#advanceBy(1);
      this.#advanceSpaces();

      let value = '';

      const quote = this.#source[0];
      const isQuoted = quote === '"' || quote === "'";
      if (isQuoted) {
        this.#advanceBy(1);
        const endQuoteIndex = this.#source.indexOf(quote);
        if (endQuoteIndex > -1) {
          value = this.#source.slice(0, endQuoteIndex);
          this.#advanceBy(value.length);
          this.#advanceBy(1);
        } else {
          __ENV__ === 'development' && error('Missing quote');
        }
      } else {
        const match = /^[^\t\r\n\f >]+/.exec(this.#source);
        value = match![0];
        this.#advanceBy(value.length);
      }

      this.#advanceSpaces();

      props.push({
        type: 'Attribute',
        name,
        value,
      });
    }

    return props;
  }

  #parseText(): Text {
    let endIndex = this.#source.length;
    const ltIndex = this.#source.indexOf('<');
    const delimiterIndex = this.#source.indexOf('{{');

    if (ltIndex > -1 && ltIndex < endIndex) {
      endIndex = ltIndex;
    }
    if (delimiterIndex > -1 && delimiterIndex < endIndex) {
      endIndex = delimiterIndex;
    }

    const content = this.#source.slice(0, endIndex);

    this.#advanceBy(content.length);

    const text: Text = {
      type: 'Text',
      content,
    };

    this.#onText(text);

    return text;
  }

  #parseComment(): Comment {
    this.#advanceBy('<!--'.length);
    const closeIndex = this.#source.indexOf('-->');
    const content = this.#source.slice(0, closeIndex);
    this.#advanceBy(content.length);
    this.#advanceBy('-->'.length);

    const comment: Comment = {
      type: 'Comment',
      content,
    };

    this.#onComment(comment);

    return comment;
  }

  #parseCDATA(): CDATA {
    this.#advanceBy('<![CDATA['.length);
    const closeIndex = this.#source.indexOf(']]>');
    const content = this.#source.slice(0, closeIndex);
    this.#advanceBy(content.length);
    this.#advanceBy(']]>'.length);

    const cdata: CDATA = {
      type: 'CDATA',
      content,
    };

    this.#onCDATA(cdata);

    return cdata;
  }

  #isEnd(ancestors: Tag[]) {
    if (!this.#source) return true;

    for (let i = ancestors.length - 1; i >= 0; --i) {
      if (this.#source.startsWith(`</${ancestors[i].name}`)) {
        return true;
      }
    }
  }

  #onTagStart(tag: Tag) {
    const attrsRenderResult = this.#renderAttributes(tag);
    const tagName = tag.name;
    const CustomElement = customElements.get(tagName);
    if (CustomElement?.prototype instanceof SRayElement) {
      const el = new CustomElement() as SRayElement<any, any>;
      attrsRenderResult.bindings.forEach(binding => {
        switch (binding.type) {
          case BindingType.BooleanAttr:
          case BindingType.Property:
            el[binding.name] = binding.value;
            break;
          case BindingType.NormalAttr:
            el.setAttribute(binding.name, binding.value);
            break;
        }
      });
      el.connectedCallback();
      this.#chunks.push(`<${tag.name}${attrsRenderResult.str}>${el.toString()}`);
    } else {
      this.#chunks.push(`<${tag.name}${attrsRenderResult.str}>`);
    }
  }

  #onTagEnd(tag: Tag) {
    this.#chunks.push(`</${tag.name}>`);
  }

  #onText(text: Text) {
    bindingRE.lastIndex = 0;

    const pattern = text.content;
    let transformedText = pattern;
    let m = bindingRE.exec(pattern);
    while (m) {
      const dynamicPartSpecifier = m[0];
      const dId = m[1];
      const dynamicInterpolator = this.#dynamicPartToGetterMap.get(dynamicPartSpecifier);
      const value = isFuncInterpolator(dynamicInterpolator)
        ? this.#runGetter(dynamicInterpolator, dynamicPartSpecifier)
        : dynamicInterpolator;

      let currentValue = '';
      if (isSSRTemplate(value)) {
        currentValue = value.toString(dId);
      } else if (isArray(value)) {
        const id = templateId++;
        currentValue = `<!--[[${id}-${dId}-->`;
        currentValue += value.map((tpl: SSRTemplate) => tpl.toString()).join('');
        currentValue += `<!--${id}-${dId}]]-->`;
      } else {
        const textWrapperId = textWarpperId++;
        // If the value is evaluated to an empty string, we will use a space to replace it so that it will render a text node in the browser
        const strValue = sanitizeHtml(String(value)) || ' ';
        currentValue = `<!--%${textWrapperId}-${dId}-->${strValue}<!--${textWrapperId}-${dId}%-->`;
      }
      currentValue += `<!--${childrenAnchor}-->`;
      const startIdx = transformedText.indexOf(dynamicPartSpecifier);
      const endIdx = startIdx + dynamicPartSpecifier.length;
      transformedText = transformedText.slice(0, startIdx) + currentValue + transformedText.slice(endIdx);
      bindingRE.lastIndex = m.index + dynamicPartSpecifier.length;

      m = bindingRE.exec(pattern);
    }

    this.#chunks.push(transformedText);
  }

  #onComment(comment: Comment) {
    this.#chunks.push(`<!--${comment.content}-->`);
  }

  #onCDATA(cdata: CDATA) {
    this.#chunks.push(`<![CDATA[${cdata.content}]]>`);
  }

  #renderAttributes(tag: Tag) {
    const attrs = tag.attrs;

    const result: AttributesRenderResult = {
      str: '',
      bindings: [],
    };

    if (!attrs.length) {
      return result;
    }

    for (const attr of attrs) {
      // dprint-ignore
      const bindingType = attr.name[0] === '?'
        ? BindingType.BooleanAttr
        : attr.name[0] === '@'
          ? BindingType.Event
          : attr.name[0] === ':'
            ? BindingType.Property
            : attr.name === 'ref'
              ? BindingType.Ref
              : BindingType.NormalAttr;

      const attrName = attr.name.replace(/^[?@:]/, '');
      const dynamicPartSpecifiers: string[] = [];

      bindingRE.lastIndex = 0;

      const pattern = attr.value;
      let attrValue: unknown = pattern;
      let hasBinding = false;
      let m = bindingRE.exec(pattern || '');
      while (m) {
        hasBinding = true;
        const dynamicPartSpecifier = m[0];
        dynamicPartSpecifiers.push(dynamicPartSpecifier);

        const getter = this.#dynamicPartToGetterMap.get(dynamicPartSpecifier);
        if (!isFuncInterpolator(getter)) {
          __ENV__ === 'development' &&
            error(`Invalid binding, you must provide a function as a value getter for the attribute "${attr.name}"`);
          return result;
        }

        switch (bindingType) {
          case BindingType.BooleanAttr:
            attrValue = !!this.#runGetter(getter, dynamicPartSpecifier);
            break;
          case BindingType.NormalAttr:
            const text = sanitizeHtml(String(this.#runGetter(getter, dynamicPartSpecifier)));
            attrValue = String(attrValue).replace(dynamicPartSpecifier, text);
            bindingRE.lastIndex = m.index + Math.max(text.length, dynamicPartSpecifier.length);
            break;
          case BindingType.Event:
          case BindingType.Ref:
            attrValue = getter;
            break;
          case BindingType.Property:
            attrValue = this.#runGetter(getter, dynamicPartSpecifier);
            break;
        }

        m = bindingRE.exec(pattern!);
      }

      switch (bindingType) {
        case BindingType.BooleanAttr:
          result.str += ` ${attr.name}="${pattern}"`;
          result.str += ` ${attr.name.slice(1)}`;
          break;
        case BindingType.NormalAttr:
          result.str += hasBinding ? ` #${attr.name}="${pattern}"` : '';
          result.str += attrValue ? ` ${attr.name}="${attrValue}"` : ` ${attr.name}`;
          break;
        case BindingType.Event:
        case BindingType.Ref:
        case BindingType.Property:
          result.str += ` ${attr.name}="${pattern}"`;
          break;
      }

      result.bindings.push({
        type: bindingType,
        name: attrName,
        value: attrValue,
        dynamicPartSpecifiers,
      } as Binding);
    }

    return result;
  }

  // these are making the SSRTemplate to be qulified as a Target
  update(_specifier: string) {}
  isInUse = true;

  #runGetter(getter: FunctionInterpolator, dynamicPartSpecifier: string) {
    pushReactiveContextStack({
      target: this,
      specifier: dynamicPartSpecifier,
    });
    const value = getter();
    popReactiveContextStack();
    return value;
  }
}

export function createSSRTemplateFunction(isUnsafe: boolean) {
  return (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Template => {
    const { templateString, dynamicPartToGetterMap } = getTemplateMetadata(strings, values, isUnsafe);

    const template = new SSRTemplate(templateString, dynamicPartToGetterMap);

    return template as unknown as Template;
  };
}
