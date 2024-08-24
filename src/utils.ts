export function createTextNode(text: string) {
  return document.createTextNode(text);
}

export function createComment(text: string) {
  return document.createComment(text);
}

export function isArray(value: any): value is any[] {
  return Array.isArray(value);
}

export function error(message: string) {
  throw new Error(message);
}
