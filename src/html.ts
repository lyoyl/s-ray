export function html(strings: TemplateStringsArray, ...values: unknown[]) {
  const templateString = String.raw({ raw: strings }, ...values);
  const template = document.createElement('template');
  template.innerHTML = templateString;
  return template.content;
}