/**
 * Build profile.html URL for a Firebase Auth uid, or "" if invalid.
 */
export function profileHref(uid) {
  if (uid == null || typeof uid !== "string") return "";
  const u = uid.trim();
  if (!u || u.length > 128 || !/^[a-zA-Z0-9]+$/.test(u)) return "";
  return `profile.html?uid=${encodeURIComponent(u)}`;
}

/**
 * Avatar circle: <a class="profile-av-link …"> when uid is valid, else fallback tag.
 * @param {string} [styleAttr] attribute value only (no "style=" wrapper)
 * @param {string} escapedInner HTML-safe inner text
 * @param {{ stopPropagation?: boolean }} [opts]
 */
export function profileAvatarHtml(uid, fallbackTag, classNames, styleAttr, escapedInner, opts = {}) {
  const href = profileHref(uid);
  const st = styleAttr ? ` style="${styleAttr}"` : "";
  const cls = classNames.trim();
  const stop = opts.stopPropagation ? ` onclick="event.stopPropagation()"` : "";
  if (href) {
    return `<a href="${href}" class="profile-av-link ${cls}"${st} title="View profile"${stop}>${escapedInner}</a>`;
  }
  return `<${fallbackTag} class="${cls}"${st}>${escapedInner}</${fallbackTag}>`;
}
