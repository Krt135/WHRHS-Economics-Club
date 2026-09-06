export function renderWithLinks(text, escFn) {
  return escFn(text).replace(
    /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );
}

export function insertLinkAtCursor(textarea) {
  const label = prompt('Link label:');
  if (!label) return;
  const url = prompt('URL (must start with https://):');
  if (!url || !/^https?:\/\//i.test(url)) return alert('Invalid URL. Must start with https://');
  const insertion = `[${label}](${url})`;
  const start = textarea.selectionStart;
  const end   = textarea.selectionEnd;
  textarea.value = textarea.value.slice(0, start) + insertion + textarea.value.slice(end);
  textarea.selectionStart = textarea.selectionEnd = start + insertion.length;
  textarea.focus();
}