export function createTextNode(text: string) {
  return document.createTextNode(text);
}

export function createComment(text: string) {
  return document.createComment(text);
}

export function isArray(value: any): value is any[] {
  return Array.isArray(value);
}

export function error(message: string, ...args: any[]) {
  console.error(`[s-ray error]: ${message}`, ...args);
}

const escapeMap = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};
export function sanitizeHtml(htmlString: string) {
  return htmlString.replace(/[&<>"']/g, (match) => escapeMap[match as keyof typeof escapeMap]);
}
