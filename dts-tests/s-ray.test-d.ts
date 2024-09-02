import { expectType } from 'tsd';

import {
  AttrDefinition,
  computed,
  defineBooleanAttr,
  defineElement,
  defineNumberAttr,
  defineProperty,
  defineStringAttr,
  html,
  ref,
  watch,
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
  props: [
    defineProperty('myProp'),
    defineProperty('myAttr', 10),
    defineProperty('myAnotherAttr', 'default'),
    defineProperty('obj', { a: 1 }),
  ] as const,
  setup(hostElement) {
    expectType<boolean>(hostElement.disabled);
    expectType<number>(hostElement.myAttr);
    expectType<string>(hostElement.myAnotherAttr);
    // props
    expectType<any>(hostElement.myProp);
    expectType<number>(hostElement.myAttr);
    expectType<string>(hostElement.myAnotherAttr);
    expectType<{ a: number }>(hostElement.obj);

    return {
      template: html``,
    };
  },
});

const myApp = new MyApp();
expectType<boolean>(myApp.disabled);
expectType<number>(myApp.myAttr);
expectType<string>(myApp.myAnotherAttr);

declare const myApp2: InstanceType<typeof MyApp>;
expectType<boolean>(myApp2.disabled);
expectType<number>(myApp2.myAttr);
expectType<string>(myApp2.myAnotherAttr);
// props
expectType<any>(myApp.myProp);
expectType<number>(myApp.myAttr);
expectType<string>(myApp.myAnotherAttr);
expectType<{ a: number }>(myApp.obj);

// reactivity API
const counter = ref(0);
expectType<number>(counter.value);
const double = computed(() => counter.value * 2);
expectType<number>(double.value);

watch(counter, (newValue, oldValue, onInvalidate) => {
  expectType<number>(newValue);
  expectType<number | null>(oldValue);
  expectType<(cb: CallableFunction) => void>(onInvalidate);
});

watch(() => double.value, (newValue, oldValue, onInvalidate) => {
  expectType<number>(newValue);
  expectType<number | null>(oldValue);
  expectType<(cb: CallableFunction) => void>(onInvalidate);
});
