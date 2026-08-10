/*
  font-options.js
  ────────────────────────────────────────────────────────────
  Shared font-picker module for any page where members write or
  edit long-form content (articles, lessons, etc).

  Usage in a page's own JS file:

    import { FONT_OPTIONS, DEFAULT_FONT, populateFontSelect, getFontStack, applyFont }
      from './font-options.js';

    // 1) When a compose/edit modal opens:
    populateFontSelect(document.getElementById('myFontSelect'), existingDoc?.fontFamily);

    // 2) When saving a post:
    const fontFamily = document.getElementById('myFontSelect').value; // e.g. "georgia"
    // ...include fontFamily in the object you write to Firestore

    // 3) When rendering a post:
    applyFont(contentEl, doc.fontFamily);
  ────────────────────────────────────────────────────────────
*/

export const FONT_OPTIONS = [
    { key: 'arial',      label: 'Arial',            stack: "Arial, Helvetica, sans-serif" },
    { key: 'times',      label: 'Times New Roman',  stack: "'Times New Roman', Times, serif" },
    { key: 'georgia',    label: 'Georgia',          stack: "Georgia, 'Times New Roman', serif" },
    { key: 'courier',    label: 'Courier New',      stack: "'Courier New', Courier, monospace" },
    { key: 'verdana',    label: 'Verdana',          stack: "Verdana, Geneva, sans-serif" },
    { key: 'trebuchet',  label: 'Trebuchet MS',     stack: "'Trebuchet MS', sans-serif" },
    { key: 'palatino',   label: 'Palatino',         stack: "'Palatino Linotype', 'Book Antiqua', Palatino, serif" },
    { key: 'garamond',   label: 'Garamond',         stack: "Garamond, 'Apple Garamond', 'Times New Roman', serif" },
];

export const DEFAULT_FONT = 'arial';

/**
 * Fill a <select> element with the font options.
 * @param {HTMLSelectElement} selectEl
 * @param {string} [selectedKey] - font key to pre-select (e.g. when editing an existing post)
 */
export function populateFontSelect(selectEl, selectedKey) {
    if (!selectEl) return;
    selectEl.innerHTML = FONT_OPTIONS.map(f =>
        `<option value="${f.key}" style="font-family:${f.stack}">${f.label}</option>`
    ).join('');
    selectEl.value = selectedKey && FONT_OPTIONS.some(f => f.key === selectedKey)
        ? selectedKey
        : DEFAULT_FONT;
}

/**
 * Look up the CSS font-family stack for a saved font key.
 * @param {string} key
 * @returns {string}
 */
export function getFontStack(key) {
    const match = FONT_OPTIONS.find(f => f.key === key);
    return match ? match.stack : FONT_OPTIONS.find(f => f.key === DEFAULT_FONT).stack;
}

/**
 * Apply a saved font key directly to a rendered content element.
 * @param {HTMLElement} el
 * @param {string} key
 */
export function applyFont(el, key) {
    if (!el) return;
    el.style.fontFamily = getFontStack(key);
}
