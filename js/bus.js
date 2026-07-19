export function navigate(screen, param = null) {
  document.dispatchEvent(new CustomEvent('app:navigate', { detail: { screen, param } }));
}
