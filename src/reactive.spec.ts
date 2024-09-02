import { expect } from '@esm-bundle/chai';
import { fake, useFakeTimers } from 'sinon';

import { computed, ref, watch } from './reactive.js';
import { Priority, nextTick } from './scheduler.js';

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

  it('watch with options - specify the priority', async () => {
    const count = ref(0);

    const callOrder: string[] = [];
    const cb1 = fake(() => callOrder.push('cb1'));
    const cb2 = fake(() => callOrder.push('cb2'));
    const cb3 = fake(() => callOrder.push('cb3'));
    const cb4 = fake(() => callOrder.push('cb4'));
    watch(count, cb1, { priority: Priority.Low });
    watch(count, cb2, { priority: Priority.High });
    watch(count, cb3, { priority: Priority.Middle });
    watch(count, cb4, { priority: Priority.Immediate });

    expect(cb1.callCount).to.equal(0);
    expect(cb2.callCount).to.equal(0);
    expect(cb3.callCount).to.equal(0);
    expect(cb4.callCount).to.equal(1);
    expect(callOrder).to.eql(['cb4']);

    count.value = 1;
    expect(cb4.callCount).to.equal(2);
    await nextTick();
    expect(cb1.callCount).to.equal(1);
    expect(cb2.callCount).to.equal(1);
    expect(cb3.callCount).to.equal(1);
    expect(callOrder).to.eql(['cb4', 'cb4', 'cb2', 'cb3', 'cb1']);
  });

  it('computed should cache the value', async () => {
    const counter = ref(0);
    const getter = fake(() => counter.value * 2);
    const double = computed(getter);

    // access double.value multiple times
    double.value;
    double.value;
    double.value;
    expect(getter.callCount).to.equal(1);
    expect(double.value).to.equal(0);

    counter.value = 1;
    expect(double.value).to.equal(2); // this should trigger the getter to be run
    expect(getter.callCount).to.equal(2);
    // the following access should not trigger the getter to be run
    double.value;
    double.value;
    double.value;
    expect(getter.callCount).to.equal(2);
  });

  it('watch a computed value', async () => {
    const counter = ref(0);
    const double = computed(() => counter.value * 2);

    const cb = fake();
    watch(() => double.value, cb);

    expect(cb.callCount).to.equal(0);

    counter.value = 1;
    await nextTick();
    expect(cb.callCount).to.equal(1);
    expect(cb.firstCall.args[0]).to.equal(2);
    expect(cb.firstCall.args[1]).to.equal(0);

    counter.value = 2;
    await nextTick();
    expect(cb.callCount).to.equal(2);
    expect(cb.secondCall.args[0]).to.equal(4);
    expect(cb.secondCall.args[1]).to.equal(2);
  });

  it('computed dependency chain', async () => {
    const counter = ref(0);
    const double = computed(() => counter.value * 2);
    const triple = computed(() => double.value * 3);

    const cb = fake();
    watch(() => triple.value, cb);

    expect(cb.callCount).to.equal(0);

    counter.value = 1;
    await nextTick();
    expect(cb.callCount).to.equal(1);
    expect(cb.firstCall.args[0]).to.equal(6);
    expect(cb.firstCall.args[1]).to.equal(0);

    counter.value = 2;
    await nextTick();
    expect(cb.callCount).to.equal(2);
    expect(cb.secondCall.args[0]).to.equal(12);
    expect(cb.secondCall.args[1]).to.equal(6);
  });
});
