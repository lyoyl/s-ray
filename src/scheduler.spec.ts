import { expect } from '@esm-bundle/chai';
import { fake } from 'sinon';
import { Priority, nextTick, queueTask } from './scheduler.js';

describe('Scheduler', () => {
  it('queue a task and await nextTick', async () => {
    const task = fake();
    queueTask(task);
    expect(task.callCount).to.equal(0);
    await nextTick();
    expect(task.callCount).to.equal(1);
  });

  it('should deduplicate tasks', async () => {
    const task = fake();
    queueTask(task);
    queueTask(task);
    await nextTick();
    expect(task.callCount).to.equal(1);
  });

  it('some tasks is going to queue a task that is not flushed, we should deduplicate that unflushed task', async () => {
    const taskA = fake(() => {
      queueTask(taskC);
    });
    const taskB = fake(() => {
      queueTask(taskC);
    });
    const taskC = fake();

    queueTask(taskA);
    queueTask(taskB);
    await nextTick();

    expect(taskA.callCount).to.equal(1);
    expect(taskB.callCount).to.equal(1);
    expect(taskC.callCount).to.equal(1);
  });

  it('queue an already executed task, should re-queue it', async () => {
    const taskA = fake();
    const taskB = fake(() => {
      queueTask(taskA);
    });
    const taskC = fake(() => {
      queueTask(taskA);
    });

    queueTask(taskA);
    queueTask(taskB);
    queueTask(taskC);
    await nextTick();

    expect(taskA.callCount).to.equal(2);
    expect(taskB.callCount).to.equal(1);
    expect(taskC.callCount).to.equal(1);
  });

  it('queue an immediate task', async () => {
    const task = fake();
    queueTask(task, Priority.Immediate);
    expect(task.callCount).to.equal(1);
  });

  it('queue tasks with different priorities', async () => {
    const result: string[] = [];
    const taskA = () => result.push('A');
    const taskB = () => result.push('B');
    const taskC = () => result.push('C');
    const taskD = () => result.push('D');

    queueTask(taskA, Priority.Low);
    queueTask(taskB, Priority.Middle);
    queueTask(taskC, Priority.High);
    queueTask(taskD, Priority.Middle);
    await nextTick();

    expect(result).to.deep.equal(['C', 'B', 'D', 'A']);
  });
});
