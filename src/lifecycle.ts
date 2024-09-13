import { currentInstance } from './defineElement.js';
import { error } from './utils.js';

/**
 * @public
 */
export function onConnected(cb: CallableFunction) {
  if (!currentInstance) {
    __ENV__ === 'development' && error('onConnected must be called inside the setup() function of your custom element');
    return;
  }
  currentInstance.addConnectedCallback(cb);
}

/**
 * @public
 */
export function onDisconnected(cb: CallableFunction) {
  if (!currentInstance) {
    __ENV__ === 'development' &&
      error('onDisconnected must be called inside the setup() function of your custom element');
    return;
  }
  currentInstance.addDisconnectedCallback(cb);
}
