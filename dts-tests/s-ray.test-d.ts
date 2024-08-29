import { expectType } from 'tsd';

import {
  AttrDefinition,
  SRayElement,
  defineBooleanAttr,
  defineElement,
  defineNumberAttr,
  defineStringAttr,
  html,
} from '@lyoyl/s-ray';

expectType<AttrDefinition<'disabled', BooleanConstructor, boolean, 'disabled'>>(defineBooleanAttr('disabled', false));

// Attribute name: hyphen to camel
expectType<AttrDefinition<'my-attr', BooleanConstructor, boolean, 'myAttr'>>(defineBooleanAttr('my-attr', false));

expectType<AttrDefinition<'my-attr', NumberConstructor, number, 'myAttr'>>(defineNumberAttr('my-attr', 0));

expectType<AttrDefinition<'my-attr', StringConstructor, string, 'myAttr'>>(defineStringAttr('my-attr', ''));

// defineElement()
const MyApp = defineElement({
  name: 'my-app',
  attrs: [
    defineNumberAttr('my-attr', 0),
    defineBooleanAttr('disabled', false),
    defineStringAttr('my-another-attr', 'default'),
  ] as const, // We have to use `as const` to prevent TypeScript from widening the type of the array
  setup() {
    return {
      template: html``,
    };
  },
});

const myApp = new MyApp();
expectType<boolean>(myApp.disabled);
expectType<number>(myApp.myAttr);
expectType<string>(myApp.myAnotherAttr);
