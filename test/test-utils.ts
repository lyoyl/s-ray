export function fixture(htmlString: string) {
  const container = document.createElement('div');
  container.innerHTML = htmlString;
  document.body.appendChild(container);
  return () => container.remove();
}

export function getMiddleOfElement(element: HTMLElement, arbitraryOffset = 0) {
  const { x, y, width, height } = element.getBoundingClientRect();
  const offsetY = arbitraryOffset ? arbitraryOffset : (window.pageYOffset + height / 2);

  return {
    x: Math.floor(x + window.pageXOffset + width / 2),
    y: Math.floor(y + offsetY),
  };
}
