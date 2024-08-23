import { html } from '../src/index.js';

let data = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
  { id: 3, name: 'Charlie' },
];

// create 10000 items
for (let i = 0; i < 10000; i++) {
  data.push({ id: i + 4, name: `User ${i + 4}` });
}

const renderList = () => {
  return data.map(item => html`<li>${() => item.name}</li>`);
};

const template = html`
  <h1 @click=${handleClick}>List</h1>
  <ul>
    ${renderList}
  </ul>
`;

function handleClick() {
  console.log('clicked');
  data[7].name += 'Hcy!';
  data = [...data];
  template.triggerRender();
}

document.body.appendChild(template.doc);
