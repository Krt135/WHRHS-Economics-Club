/**
 * Returns the avatar background color based on role.
 * admin → gold, everything else → navy
 */
export function roleColour(role) {
  return (role === "admin") ? "#c9a84c" : "#0f1f3d";
}

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
 * @param {string}  uid
 * @param {string}  fallbackTag   e.g. "span", "div"
 * @param {string}  classNames
 * @param {string}  [styleAttr]   extra inline styles (no "style=" wrapper needed)
 * @param {string}  escapedInner  HTML-safe initials
 * @param {{ stopPropagation?: boolean, role?: string }} [opts]
 *   Pass role: "admin" | "member" | "public" to get consistent role-based color.
 *   If role is omitted, styleAttr is used as-is (backward compatible).
 */
export function profileAvatarHtml(uid, fallbackTag, classNames, styleAttr, escapedInner, opts = {}) {
  const href = profileHref(uid);
  const cls  = classNames.trim();
  const stop = opts.stopPropagation ? ` onclick="event.stopPropagation()"` : "";

  // If a role is provided, override the background color
  let finalStyle = styleAttr || "";
  if (opts.role !== undefined) {
    const bg = roleColour(opts.role);
    // Merge with any existing styleAttr, role color takes priority for background
    finalStyle = `background:${bg};${styleAttr ? styleAttr : ""}`;
  }

  const st = finalStyle ? ` style="${finalStyle}"` : "";

  if (href) {
    return `<a href="${href}" class="profile-av-link ${cls}"${st} title="View profile"${stop}>${escapedInner}</a>`;
  }
  return `<${fallbackTag} class="${cls}"${st}>${escapedInner}</${fallbackTag}>`;
}