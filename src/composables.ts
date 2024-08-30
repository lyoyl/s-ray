import { SRayElement, currentInstance } from './defineElement.js';
import { error } from './utils.js';

/**
 * @public
 */
export function getHostElement<El extends SRayElement>(): El {
  if (__DEV__ && !currentInstance) {
    error(`getHostElement() can only be called inside the setup() function of your element definition.`);
  }
  return currentInstance as El;
}
