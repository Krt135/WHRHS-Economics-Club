/*
  link-format.js
  ────────────────────────────────────────────────────────────
  Lets members insert a real, safe <a> link into plain-text post
  bodies (The Floor, and anywhere that displays a snapshot of that
  text, like Bulletin).

  How it works: the "Insert Link" button writes a literal
  <a href="..." target="_blank" rel="noopener noreferrer">label</a>
  tag directly into the textarea. Everything else in the post stays
  plain text. At render time, ONLY that exact tag shape is recognized
  and turned into a real link — anything else the member types,
  including any other raw HTML, still gets escaped as plain text like
  before. So nothing changes about how the rest of a post is handled;
  this just carves out one narrow, safe exception.
  ────────────────────────────────────────────────────────────
*/

// Matches only the exact tag shape this file generates below.
// Anything that doesn't match this precisely (different attributes,
// missing target/rel, a non-http(s)/mailto href, etc.) is left alone
// and gets escaped as plain text by the caller, same as any other text.
const LINK_RE = /<a href="(https?:\/\/[^"]+|mailto:[^"]+)" target="_blank" rel="noopener noreferrer">([^<]*)<\/a>/g;

/**
 * Render a plain-text post body, turning only our own recognized <a>
 * tags into real links and escaping everything else. Pass raw text in
 * (don't esc() it yourself first).
 * @param {string} raw
 * @param {(s:string)=>string} escFn
 */
export function renderWithLinks(raw, escFn) {
  const text = String(raw || "");
  let result = "";
  let lastIndex = 0;
  LINK_RE.lastIndex = 0;
  let m;
  while ((m = LINK_RE.exec(text)) !== null) {
    result += escFn(text.slice(lastIndex, m.index));
    const href  = m[1];
    const label = escFn(m[2]);
    result += `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    lastIndex = m.index + m[0].length;
  }
  result += escFn(text.slice(lastIndex));
  return result;
}

/**
 * Plain-text excerpt for truncated previews/cards: strips our <a> tags
 * down to just their label text before slicing, so a length cutoff can
 * never chop a tag in half and leave broken raw markup visible. Pass
 * the result through the caller's esc() before inserting into HTML.
 * @param {string} raw
 * @param {number} maxLen
 */
export function plainTextExcerpt(raw, maxLen) {
  const stripped = String(raw || "").replace(LINK_RE, "$2");
  return stripped.length > maxLen ? stripped.slice(0, maxLen) + "…" : stripped;
}

/**
 * Prompts for a URL (validated) and a label (defaulting to any
 * selected text), then inserts a real <a> tag at the cursor / around
 * the selection inside a plain <textarea>.
 * @param {HTMLTextAreaElement} textarea
 */
export function insertLinkAtCursor(textarea) {
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end   = textarea.selectionEnd;
  const selected = textarea.value.slice(start, end);

  const url = prompt("Link URL (http://, https://, or mailto:):");
  if (!url) return;
  const trimmedUrl = url.trim();
  if (!/^(https?:\/\/|mailto:)/i.test(trimmedUrl)) {
    alert("Links must start with http://, https://, or mailto:");
    return;
  }

  const label = prompt("Link text:", selected || trimmedUrl);
  if (!label) return;

  const tag = `<a href="${trimmedUrl}" target="_blank" rel="noopener noreferrer">${label.trim()}</a>`;
  textarea.setRangeText(tag, start, end, "end");
  textarea.focus();
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}