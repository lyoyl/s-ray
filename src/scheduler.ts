const p = Promise.resolve();

/**
 * @public
 */
export enum Priority {
  Immediate = 'immediate',
  High = 'high',
  Middle = 'middle',
  Low = 'low',
}

const tasks = {
  [Priority.Immediate]: new Set<CallableFunction>(),
  [Priority.High]: new Set<CallableFunction>(),
  [Priority.Middle]: new Set<CallableFunction>(),
  [Priority.Low]: new Set<CallableFunction>(),
};

let currentPromise: Promise<void> | null = null;

/**
 * @public
 */
export function nextTick() {
  if (currentPromise) {
    return currentPromise;
  }
  return p;
}

/**
 * @public
 */
export function queueTask(task: CallableFunction, priority: Priority = Priority.Middle) {
  if (priority === Priority.Immediate) {
    task();
    return;
  }
  const queue = tasks[priority];
  // Combine delete and add is a renew operation
  queue.delete(task);
  queue.add(task);

  if (!currentPromise) {
    currentPromise = p.then(flushTasks);
  }
}

function flushTasks() {
  tasks[Priority.High].forEach(task => task());
  tasks[Priority.High].clear();
  tasks[Priority.Middle].forEach(task => task());
  tasks[Priority.Middle].clear();
  tasks[Priority.Low].forEach(task => task());
  tasks[Priority.Low].clear();

  currentPromise = null;
}
