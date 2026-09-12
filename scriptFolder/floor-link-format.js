const LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;

export function renderWithLinks(text, escFn) {
  return escFn(text).replace(LINK_RE, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

/**
 * Plain-text excerpt for truncated previews/cards (e.g. Bulletin pins of
 * Floor posts): collapses our [label](url) markdown down to just the label
 * before slicing, so a length cutoff never leaves raw "[label](url)" markup
 * visible. Pass raw (unescaped) text in; the caller should esc() the result
 * before inserting into HTML, same as renderWithLinks's caller does.
 * @param {string} raw
 * @param {number} maxLen
 */
export function plainTextExcerpt(raw, maxLen) {
  const stripped = String(raw || "").replace(LINK_RE, "$1");
  return stripped.length > maxLen ? stripped.slice(0, maxLen) + "…" : stripped;
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