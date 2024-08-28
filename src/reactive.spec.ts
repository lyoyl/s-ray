import { expect } from '@esm-bundle/chai';
import { fake, useFakeTimers } from 'sinon';

import { ref, watch } from './reactive.js';
import { nextTick } from './scheduler.js';

describe('Reactive', () => {
  it('watch a ref and a getter', async () => {
    const count = ref(0);

    const cb1 = fake();
    watch(count, cb1);
    const cb2 = fake();
    watch(() => count.value * 2, cb2);

    expect(cb1.callCount).to.equal(0);
    expect(cb2.callCount).to.equal(0);

    count.value = 1;
    await nextTick();
    expect(cb1.callCount).to.equal(1);
    expect(cb1.firstCall.args[0]).to.equal(1);
    expect(cb1.firstCall.args[1]).to.equal(0);
    expect(cb2.callCount).to.equal(1);
    expect(cb2.firstCall.args[0]).to.equal(2);
    expect(cb2.firstCall.args[1]).to.equal(0);
  });

  it('unwatch', async () => {
    const count = ref(0);

    const cb = fake();
    const unwatch = watch(count, cb);

    expect(cb.callCount).to.equal(0);

    count.value = 1;
    await nextTick();
    expect(cb.callCount).to.equal(1);
    expect(cb.firstCall.args[0]).to.equal(1);
    expect(cb.firstCall.args[1]).to.equal(0);
    cb.resetHistory();

    unwatch();

    count.value = 2;
    expect(cb.callCount).to.equal(0);
  });

  it('modify a ref multiple times should only trigger the watcher once', async () => {
    const count = ref(0);

    const cb = fake();
    watch(count, cb);

    expect(cb.callCount).to.equal(0);

    count.value = 1;
    count.value = 2;
    count.value = 3;
    await nextTick();
    expect(cb.callCount).to.equal(1);
    expect(cb.firstCall.args[0]).to.equal(3);
    expect(cb.firstCall.args[1]).to.equal(0);
  });

  it('A watch run can be invalidated', async () => {
    const clock = useFakeTimers();
    const count = ref(0);

    const cb = fake();
    watch(() => count.value * 2, async (newValue, oldValue, onInvalidate) => {
      let expired = false;
      onInvalidate(() => {
        expired = true;
      });
      // simulate async operation
      await new Promise(resolve => setTimeout(resolve, 500));
      if (expired) {
        return;
      }

      cb(newValue, oldValue);
    });

    expect(cb.callCount).to.equal(0);

    count.value = 1;
    count.value = 2;
    count.value = 3;
    await nextTick();
    clock.tick(1000);
    await Promise.resolve();
    expect(cb.callCount).to.equal(1);
    expect(cb.firstCall.args[0]).to.equal(6);
    expect(cb.firstCall.args[1]).to.equal(0);

    clock.restore();
  });
});
