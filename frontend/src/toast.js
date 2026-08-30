let id = 0;

export function toast(message, type = 'info') {
  window.dispatchEvent(new CustomEvent('rotools-toast', { detail: { id: ++id, message, type } }));
}

export function showToastError(err) {
  toast(err?.message || String(err), 'error');
}
