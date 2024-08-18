export function hyphenate(str: string) {
  return str.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`).slice(1);
}
