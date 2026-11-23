// The content pages re-render a whole post (including its comment box) with
// innerHTML every time anything in the database changes, e.g. someone else's
// like or comment. Without this, whatever the reader was typing was wiped.
//
// Wrap the render call: text in any input/textarea with an id inside `root`
// is put back, along with focus, the caret position, and any elements matching
// `keepOpenSelector` that were showing (e.g. an open reply box).
export function preserveInputs(root, render, { keepOpenSelector = null } = {}) {
  if (!root) { render(); return; }

  const saved = [];
  root.querySelectorAll('textarea[id], input[id]').forEach(el => {
    if (el.type === 'file' || el.type === 'checkbox' || el.type === 'radio') return;
    if (el.value) saved.push({ id: el.id, value: el.value });
  });

  const open = keepOpenSelector
    ? [...root.querySelectorAll(keepOpenSelector)].filter(el => el.id && el.style.display !== 'none').map(el => el.id)
    : [];

  const active = document.activeElement;
  const focusId = active && active.id && root.contains(active) ? active.id : null;
  const caret = focusId && typeof active.selectionStart === 'number'
    ? [active.selectionStart, active.selectionEnd] : null;

  render();

  for (const { id, value } of saved) {
    const el = document.getElementById(id);
    if (el && root.contains(el) && !el.value) el.value = value;
  }
  for (const id of open) {
    const el = document.getElementById(id);
    if (el && root.contains(el)) el.style.display = 'block';
  }
  if (focusId) {
    const el = document.getElementById(focusId);
    if (el && root.contains(el)) {
      el.focus({ preventScroll: true });
      if (caret && typeof el.setSelectionRange === 'function') {
        try { el.setSelectionRange(caret[0], caret[1]); } catch (_) { /* not a text field */ }
      }
    }
  }
}
