import { html, ref } from '../src/index.js';

const treeData = ref({
  value: 0,
  children: [
    {
      value: 1,
      children: [
        {
          value: 3,
          children: [],
        },
      ],
    },
    {
      value: 2,
      children: [],
    },
  ],
});

function renderTree(tree: typeof treeData.value) {
  return html`
    <div>
      <span>${() => tree.value}</span>
      ${() => tree.children.map(child => renderTree(child))}
    </div>
  `;
}

const template = renderTree(treeData.value);

document.body.appendChild(template.doc);
