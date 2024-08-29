import { expectType } from 'tsd';

import { defineBooleanAttr, defineNumberAttr, defineStringAttr } from '@lyoyl/s-ray';

expectType<{
  type: BooleanConstructor,
  default: boolean,
  propertyName: 'disabled',
}>(defineBooleanAttr('disabled', false));

// Attribute name: hyphen to camel
expectType<{
  type: BooleanConstructor,
  default: boolean,
  propertyName: 'myAttr',
}>(defineBooleanAttr('my-attr', false));

expectType<{
  type: NumberConstructor,
  default: number,
  propertyName: 'myAttr',
}>(defineNumberAttr('my-attr', 0));

expectType<{
  type: StringConstructor,
  default: string,
  propertyName: 'myAttr',
}>(defineStringAttr('my-attr', ''));
