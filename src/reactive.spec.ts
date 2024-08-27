import { expect } from '@esm-bundle/chai';
import { fake } from 'sinon';

import { ref, watch } from './reactive.js';

describe('Reactive', () => {
  it('watch a ref and a getter', () => {
    const count = ref(0);

    const cb1 = fake();
    watch(count, cb1);
    const cb2 = fake();
    watch(() => count.value * 2, cb2);

    expect(cb1.callCount).to.equal(1);
    expect(cb1.firstCall.args[0]).to.equal(0);
    expect(cb2.callCount).to.equal(1);
    expect(cb2.firstCall.args[0]).to.equal(0);
    cb1.resetHistory();
    cb2.resetHistory();

    count.value = 1;
    expect(cb1.callCount).to.equal(1);
    expect(cb1.firstCall.args[0]).to.equal(1);
    expect(cb2.callCount).to.equal(1);
    expect(cb2.firstCall.args[0]).to.equal(2);
  });
});
