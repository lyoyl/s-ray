import { XCondition } from '../src/index';

customElements.define('x-condition', XCondition);

const toggleButton = document.querySelector('button')!;
const condition = document.querySelector<XCondition>('x-condition')!;

toggleButton.addEventListener('click', () => {
  condition.current = condition.current === 'foo' ? 'bar' : 'foo';
});
