// ─────────────────────────────────────────────
//  the-floor.js — with @mention system
// ─────────────────────────────────────────────

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import {
  getDatabase, ref, push, set, onValue, remove, update, get
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";
import {
  getAuth, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { firebaseConfig } from './config.js';
import { profileAvatarHtml } from "./profile-link.js";
import { softDelete } from './deletePost.js';
import { renderWithLinks, insertLinkAtCursor } from './floor-link-format.js';
import { preserveInputs } from './preserve-inputs.js';

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);
const auth = getAuth(app);

// ─────────────────────────────────────────────
//  STATE & AUTH TRACKING
// ─────────────────────────────────────────────

let currentUser      = null;
let userRole         = "public";
let userProfile      = null;
let discussions      = {};
let polls            = {};
let activeTag        = "all";
let attachedImageData = null;
let isEditMode       = false;
let pinnedIds        = new Set();

// A post can be opened from a link (the-floor.html?post=<id>, e.g. the homepage's
// "Latest from The Floor" cards) or handed over via sessionStorage (Bulletin,
// profile activity). The URL was previously ignored, so those links just showed the list.
let currentDiscId = new URLSearchParams(window.location.search).get("post")
  || sessionStorage.getItem("openFloorPost") || sessionStorage.getItem("openDiscussion") || null;

// Keeps the address bar in step with the open post so Back returns to the list
// and a post's URL can be shared. mode: 'push' | 'replace' | 'none'.
function syncPostUrl(key, mode) {
  if (mode === 'none') return;
  const params = new URLSearchParams(window.location.search);
  if ((params.get('post') || null) === (key || null)) return;
  const url = key ? `${window.location.pathname}?post=${encodeURIComponent(key)}` : window.location.pathname;
  history[mode === 'replace' ? 'replaceState' : 'pushState'](key ? { post: key } : {}, '', url);
}

window.addEventListener('popstate', () => {
  const key = new URLSearchParams(window.location.search).get('post');
  if (key && discussions[key]) showDiscussion(key, { history: 'none' });
  else showList({ history: 'none' });
});

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    const snapshot = await get(ref(db, `users/${user.uid}`));
    if (snapshot.exists()) {
      userProfile = snapshot.val();
      userRole = userProfile.role || "member";
    }
    // Only fetch the /users roster (needed for @mention autocomplete) once we
    // have a confirmed signed-in user — not unconditionally for every visitor,
    // logged in or not, before auth state is even known.
    if (!usersLoadPromise) usersLoadPromise = loadAllUsers();
  } else {
    currentUser = null;
    userRole    = "public";
    userProfile = null;
  }

  const pollBtn = document.getElementById("openPollModalBtn");
  if (pollBtn) pollBtn.style.display = (userRole === "admin") ? "block" : "none";

  // Sign-in can finish before the posts load. Rendering a missing item fell back
  // to the list and dropped the link, so leave that case to the data listener.
  if (currentDiscId) { if (discussions[currentDiscId]) showDiscussion(currentDiscId, { history: 'replace' }); }
  else renderDiscussions();
  renderPolls();
});


// ─────────────────────────────────────────────
//  @MENTION — USER LIST
// ─────────────────────────────────────────────

let allUsers = []; // { uid, displayName, email, initials }
let usersLoadPromise = null; // resolves once the first /users fetch settles, kicked off from onAuthStateChanged below

// Load all registered users for the dropdown.
async function loadAllUsers() {
  try {
    console.log('[mentions] loadAllUsers: fetching /users …');
    const snap = await get(ref(db, 'users'));
    if (!snap.exists()) {
      console.warn('[mentions] loadAllUsers: /users snapshot is empty');
      return;
    }
    allUsers = Object.entries(snap.val())
      .map(([uid, u]) => ({
        uid,
        displayName: u.displayName || u.email?.split('@')[0] || '',
        email:       u.email || '',
        initials:    (u.displayName || u.email || 'U').substring(0, 2).toUpperCase()
      }))
      .filter(u => u.displayName && u.email);
    console.log(
      `[mentions] loadAllUsers: loaded ${allUsers.length} users →`,
      allUsers.map(u => mentionKey(u.displayName))
    );
  } catch (e) {
    console.warn('[mentions] loadAllUsers: FAILED to load users for @mentions:', e);
  }
}

// The "mention key" is the displayName with everything but letters, digits and
// underscores removed — what gets typed after @.
// e.g. "John Smith" → @JohnSmith, "Liam O'Connor" → @LiamOConnor.
// (Only spaces used to be removed, so a name with an apostrophe or hyphen
// produced a key the @-parser below could never match.)
const MENTION_CHAR = /[\p{L}\p{N}_]/u;
function mentionKey(displayName) {
  return [...String(displayName || '')].filter(ch => MENTION_CHAR.test(ch)).join('');
}

// Extract all @mention keys from a body of text.
function extractMentions(text) {
  return [...new Set((text.match(/@[\p{L}\p{N}_]+/gu) || []).map(m => m.slice(1)))];
}

// Write mention records to Firebase. A Cloud Function (onNewMention) watches
// /mentions/{id} and sends the email — same onValueCreated pattern as the
// other functions in this Firebase project.
async function notifyMentions(text, contextLabel, postId) {
  try {
    console.log(`[mentions] notifyMentions: START (context: "${contextLabel}")`);
    const keys = extractMentions(text);
    if (!keys.length) {
      console.log('[mentions] notifyMentions: no @mentions in text — nothing to do');
      return;
    }

    // allUsers loads asynchronously on page load. If the user submitted before
    // that finished, allUsers is still empty and every lookup would miss — so
    // wait for the in-flight load, then retry a direct fetch as a last resort.
    if (!allUsers.length) {
      console.warn('[mentions] notifyMentions: allUsers is EMPTY — awaiting in-flight /users load …');
      try { await (usersLoadPromise || loadAllUsers()); } catch (_) {}
      if (!allUsers.length) {
        console.warn('[mentions] notifyMentions: still empty — forcing a fresh /users fetch …');
        await loadAllUsers();
      }
    }
    console.log(`[mentions] notifyMentions: matching ${keys.length} key(s) against ${allUsers.length} known user(s)`);

    for (const key of keys) {
      const user = allUsers.find(
        u => mentionKey(u.displayName).toLowerCase() === key.toLowerCase()
      );
      if (!user) {
        console.warn(`[mentions] notifyMentions: @${key} — no matching user (known keys: ${allUsers.map(u => mentionKey(u.displayName)).join(', ')})`);
        continue;
      }
      if (currentUser && user.uid === currentUser.uid) {
        console.log(`[mentions] notifyMentions: @${key} is the author — skipping self-notify`);
        continue;
      }

      const record = {
        mentionedUid:   user.uid,
        mentionedEmail: user.email,
        mentionedName:  user.displayName,
        mentionedBy:    getDisplayName(),
        context:        contextLabel,
        // Straight to the post on the live site (was a hard-coded old Vercel
        // address that only opened the Floor's front page).
        url:            `https://theeconomicforum.net/the-floor.html${postId ? `?post=${encodeURIComponent(postId)}` : ''}`,
        createdAt:      Date.now()
      };

      try {
        console.log(`[mentions] notifyMentions: writing /mentions record for @${key} …`, record);
        const newRef = push(ref(db, 'mentions'));
        await set(newRef, record);
        console.log(`[mentions] notifyMentions: ✅ wrote /mentions/${newRef.key} for @${key} — onNewMention should now fire`);
      } catch (err) {
        console.error(
          `[mentions] notifyMentions: ❌ write to /mentions FAILED for @${key} —`,
          err && (err.code || err.message || err)
        );
        if (err && String(err.code || err).includes('PERMISSION_DENIED')) {
          console.error('[mentions] notifyMentions: this is a security-rules problem. Add write access for authenticated users to /mentions in the Realtime Database rules.');
        }
      }
    }
    console.log('[mentions] notifyMentions: DONE');
  } catch (e) {
    console.error('[mentions] notifyMentions: unexpected error (post itself was unaffected):', e);
  }
}


// ─────────────────────────────────────────────
//  @MENTION — DROPDOWN UI
// ─────────────────────────────────────────────

// Tracks the active mention being typed
let mentionState = { active: false, textarea: null, startIdx: 0, query: '' };

function handleMentionInput(e) {
  const ta = e.target;
  const cursor = ta.selectionStart;
  const beforeCursor = ta.value.slice(0, cursor);
  // Match the last @ and any name characters following it, right before the cursor
  const match = beforeCursor.match(/@([\p{L}\p{N}_]*)$/u);

  if (match) {
    mentionState = {
      active:   true,
      textarea: ta,
      startIdx: cursor - match[0].length,
      query:    match[1].toLowerCase()
    };
    showMentionDropdown(ta, mentionState.query);
  } else {
    hideMentionDropdown();
  }
}

function handleMentionKeydown(e) {
  if (!mentionState.active) return;
  const dropdown = document.getElementById('mention-dropdown');
  if (!dropdown || dropdown.style.display === 'none') return;

  const items = [...dropdown.querySelectorAll('.mention-item')];
  const focusedIdx = items.findIndex(i => i.classList.contains('focused'));

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    const next = focusedIdx < items.length - 1 ? focusedIdx + 1 : 0;
    items.forEach((i, idx) => i.classList.toggle('focused', idx === next));
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    const prev = focusedIdx > 0 ? focusedIdx - 1 : items.length - 1;
    items.forEach((i, idx) => i.classList.toggle('focused', idx === prev));
  } else if (e.key === 'Enter') {
    const focused = dropdown.querySelector('.mention-item.focused');
    if (focused) { e.preventDefault(); insertMention(focused.dataset.key); }
  } else if (e.key === 'Escape') {
    hideMentionDropdown();
  }
}

function showMentionDropdown(ta, query) {
  const dropdown = document.getElementById('mention-dropdown');
  if (!dropdown) return;

  // Filter users whose mention key contains the query
  const matches = allUsers
    .filter(u => mentionKey(u.displayName).toLowerCase().includes(query))
    .slice(0, 8);

  if (!matches.length) { hideMentionDropdown(); return; }

  // Position: below the textarea, or above if not enough room
  const rect    = ta.getBoundingClientRect();
  const dropH   = Math.min(matches.length * 52, 240);
  const spaceBelow = window.innerHeight - rect.bottom;
  const top = spaceBelow > dropH + 8 ? rect.bottom + 4 : rect.top - dropH - 4;

  dropdown.style.cssText = `
    display: block;
    position: fixed;
    left: ${rect.left}px;
    top: ${top}px;
    width: ${Math.max(rect.width, 220)}px;
  `;

  dropdown.innerHTML = matches.map((u, i) => `
    <div class="mention-item ${i === 0 ? 'focused' : ''}"
         data-key="${esc(mentionKey(u.displayName))}">
      <div class="mention-av">${esc(u.initials)}</div>
      <div>
        <div class="mention-name">${esc(u.displayName)}</div>
        <div class="mention-handle">@${esc(mentionKey(u.displayName))}</div>
      </div>
    </div>
  `).join('');

  dropdown.querySelectorAll('.mention-item').forEach(item => {
    // mousedown (not click) so it fires before the textarea loses focus
    item.addEventListener('mousedown', e => {
      e.preventDefault();
      insertMention(item.dataset.key);
    });
    item.addEventListener('mouseover', () => {
      dropdown.querySelectorAll('.mention-item').forEach(i => i.classList.remove('focused'));
      item.classList.add('focused');
    });
  });
}

function hideMentionDropdown() {
  const dropdown = document.getElementById('mention-dropdown');
  if (dropdown) dropdown.style.display = 'none';
  mentionState.active = false;
}

// Insert the chosen @mention into the textarea at the right position
function insertMention(key) {
  const ta = mentionState.textarea;
  if (!ta) return;
  const before = ta.value.slice(0, mentionState.startIdx);
  const after  = ta.value.slice(ta.selectionStart);
  ta.value = `${before}@${key} ${after}`;
  const pos = mentionState.startIdx + key.length + 2;
  ta.selectionStart = ta.selectionEnd = pos;
  hideMentionDropdown();
  ta.focus();
}

// Attach input + keydown listeners to textareas that don't already have them.
// Called after renderDiscussionView() so comment/reply inputs are in the DOM.
function attachMentionListeners() {
  const targets = [
    document.getElementById('cmtInput'),
    ...document.querySelectorAll('[id^="reply-input-"]')
  ].filter(Boolean);

  targets.forEach(el => {
    if (el._mentionAttached) return;
    el.addEventListener('input', handleMentionInput);
    el.addEventListener('keydown', handleMentionKeydown);
    el._mentionAttached = true;
  });
}

// Attach to the post textarea (always in DOM) and set up global close-on-click
const discContentTA = document.getElementById('discContent');
if (discContentTA) {
  discContentTA.addEventListener('input', handleMentionInput);
  discContentTA.addEventListener('keydown', handleMentionKeydown);
}
document.addEventListener('click', e => {
  if (!e.target.closest('#mention-dropdown')) hideMentionDropdown();
});


// ─────────────────────────────────────────────
//  UTILITIES
// ─────────────────────────────────────────────

function getDisplayName() {
  if (userProfile && userProfile.displayName) return userProfile.displayName;
  if (currentUser && currentUser.email) return currentUser.email.split("@")[0];
  return "Member";
}


// ─────────────────────────────────────────────
//  FIREBASE LISTENERS
// ─────────────────────────────────────────────

// Pinned-post lookup resolves to null on failure so a bulletin read error can't
// stop the discussion list from rendering.
const fetchBulletin = () => get(ref(db, 'bulletin')).catch(() => null);

// Started now, in parallel with the discussions listener below, instead of
// only after the first discussions snapshot arrives (one fewer round trip).
let bulletinPrefetch = fetchBulletin();

onValue(ref(db, "discussions"), snapshot => {
  discussions = snapshot.val() || {};

  if (currentDiscId) {
    if (discussions[currentDiscId]) {
      sessionStorage.removeItem("openFloorPost");
      sessionStorage.removeItem("openDiscussion");
      // 'replace' (not push): this runs on every data update, and also gives a
      // post opened from the Bulletin its own shareable ?post= address.
      showDiscussion(currentDiscId, { history: 'replace' });
    } else {
      console.warn("Discussion not found, defaulting to list.");
      currentDiscId = null;
      showList({ history: 'replace' });
    }
  } else {
    const bulletinReq = bulletinPrefetch || fetchBulletin();
    bulletinPrefetch = null;
    bulletinReq.then(snap => {
      const data = (snap && snap.val()) || {};
      pinnedIds = new Set(
        Object.values(data).map(v => v.originalId || v.discussionId).filter(Boolean)
      );
      renderDiscussions();
    });
  }
});

onValue(ref(db, "polls"), snapshot => {
  polls = snapshot.val() || {};
  renderPolls();
});


// ─────────────────────────────────────────────
//  RENDER — DISCUSSION LIST
// ─────────────────────────────────────────────

function renderDiscussions() {
  const list = document.getElementById("discussionsList");
  if (!list) return;

  let items = Object.entries(discussions)
    .map(([key, val]) => ({ ...val, _key: key }))
    .sort((a, b) => b.postedAt - a.postedAt);

  if (!items.length) {
    list.innerHTML = `<div class="empty-state"><p class="empty-text">No discussions yet.</p></div>`;
    return;
  }

  list.innerHTML = items.map(d => {
    const commentCount = d.comments ? Object.keys(d.comments).length : 0;

    let cardTheme = "theme-member";
    if (currentUser && d.authorId === currentUser.uid) cardTheme = "theme-me";
    else if (d.authorRole === "admin") cardTheme = "theme-exec";

    const isPinned = pinnedIds.has(d._key);

    return `
<div class="disc-card ${cardTheme}" role="link" tabindex="0" onclick="window.showDiscussion('${d._key}')">
  ${d.image ? `<img src="${esc(d.image)}" class="disc-image" alt="">` : ""}
  <div class="disc-title" style="${isPinned ? 'color:var(--gold-text)' : ''}">${esc(d.title)}</div>
  ${isPinned ? `
  <div class="pinned-badge">
    <svg width="11" height="11" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
    Pinned to Bulletin
  </div>` : ''}
  <div class="disc-body">${renderWithLinks(d.body, esc)}</div>
  <div class="disc-meta">
    <span class="author">
      ${profileAvatarHtml(d.authorId, "span", "author-av", "", esc(d.authorInitials || "?"), { stopPropagation: true, role: d.authorRole || "member" })}
      ${esc(d.author)}
    </span>
    <span>·</span>
    <span>${rel(d.postedAt)}</span>
    <span>·</span>
    <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
    ${commentCount}
  </div>
</div>`;
  }).join("");
}


// ─────────────────────────────────────────────
//  RENDER — SINGLE DISCUSSION VIEW
// ─────────────────────────────────────────────

function renderDiscussionView() {
  const d = discussions[currentDiscId];
  if (!d) { showList({ history: 'replace' }); return; }

  const commentEntries = d.comments
    ? Object.entries(d.comments).map(([k, v]) => ({ ...v, _key: k })).sort((a, b) => a.postedAt - b.postedAt)
    : [];

  const canEdit   = currentUser && d.authorId === currentUser.uid;
  const canDelete = currentUser && (d.authorId === currentUser.uid || userRole === 'admin');
  const isAdmin   = userRole === "admin";

  get(ref(db, "bulletin")).then(snap => {
    const bulletinData  = snap.val() || {};
    const alreadyPinned = Object.values(bulletinData).some(
      b => b.discussionId === currentDiscId || b.originalId === currentDiscId
    );
    const topActions = document.getElementById("discTopActions");
    if (topActions) {
      topActions.innerHTML = `
        ${canEdit ? `
          <button class="topbar-btn btn-edit" onclick="window.openEditModal()">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Edit
          </button>` : ""}
        ${canDelete ? `
          <button class="topbar-btn btn-del-tb" onclick="window.deleteDiscussion()">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>Delete
          </button>` : ""}
        ${isAdmin ? `
          <button class="topbar-btn btn-pin-tb ${alreadyPinned ? "pinned" : ""}" onclick="window.togglePin('${currentDiscId}', ${alreadyPinned})">
            <svg width="13" height="13" fill="${alreadyPinned ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
            ${alreadyPinned ? "Unpin" : "Pin to Bulletin"}
          </button>` : ""}`;
    }
  });

  let postTheme = "theme-member";
  if (currentUser && d.authorId === currentUser.uid) postTheme = "theme-me";
  else if (d.authorRole === "admin") postTheme = "theme-exec";

  const commentsHtml = commentEntries.map(c => {
    const canDeleteComment = currentUser && (c.authorId === currentUser.uid || userRole === "admin");
    let cmtTheme = (currentUser && c.authorId === currentUser.uid) ? "theme-me"
                 : (c.authorRole === "admin" ? "theme-exec" : "theme-member");

    const replies = c.replies
      ? Object.entries(c.replies).map(([rk, rv]) => ({ ...rv, _key: rk })).sort((a, b) => a.postedAt - b.postedAt)
      : [];

    const repliesHtml = replies.map(r => {
      const canDeleteReply = currentUser && (r.authorId === currentUser.uid || userRole === "admin");
      return `
        <div class="reply-item" style="display:flex; gap:8px; margin-top:12px;">
          ${profileAvatarHtml(r.authorId, "span", "author-av", "", esc(r.initials || "?"), { stopPropagation: true, role: r.authorRole || "member" })}
          <div class="comment-bubble" style="flex:1;">
            <div class="comment-hdr">
              <span class="comment-author">${esc(r.author)}</span>
              <span class="comment-time">${rel(r.postedAt)}</span>
            </div>
            <div class="comment-text">${esc(r.text)}</div>
            ${canDeleteReply ? `
              <div class="comment-acts">
                <button class="cmt-act cmt-del" onclick="deleteReply('${currentDiscId}','${c._key}','${r._key}')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>Delete
                </button>
              </div>` : ""}
          </div>
        </div>`;
    }).join("");

    return `
    <div class="comment-item ${cmtTheme}">
      ${profileAvatarHtml(c.authorId, "span", "author-av", "", esc(c.initials || "?"), { stopPropagation: true, role: c.authorRole || "member" })}
      <div class="comment-bubble">
        <div class="comment-hdr">
          <span class="comment-author">${esc(c.author)}</span>
          <span class="comment-time">${rel(c.postedAt)}</span>
        </div>
        <div class="comment-text">${esc(c.text)}</div>
        <div class="comment-acts">
          <button class="cmt-act" onclick="window.toggleReplyBox('${c._key}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 00-4-4H4"/></svg>Reply
          </button>
          ${canDeleteComment ? `
          <button class="cmt-act cmt-del" onclick="deleteComment('${currentDiscId}','${c._key}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>Delete
          </button>` : ""}
        </div>
        ${replies.length > 0 ? `<div style="margin-left:8px; padding-left:12px; border-left:2px solid #e5e7eb;">${repliesHtml}</div>` : ""}
        <div id="reply-box-${c._key}" style="display:none; margin-top:12px; margin-left:8px; padding-left:12px; border-left:2px solid #e5e7eb;">
          <div style="display:flex; gap:8px;">
            <input type="text" id="reply-input-${c._key}" class="new-comment-input"
              placeholder="Write a reply… type @ to mention someone"
              style="min-height:36px; height:36px;">
            <button class="btn-post-cmt" onclick="window.postReply('${c._key}')">Post</button>
          </div>
        </div>
      </div>
    </div>`;
  }).join("");

  const plural = commentEntries.length === 1 ? '' : 's';
  const commentLabel = `${commentEntries.length} comment${plural}`;
  const commentTitle = `${commentEntries.length} Comment${plural}`;
  const bodyEl = document.getElementById("discussionBody");
  // Re-rendered on every database change: keep what the reader is typing
  // (and any reply box they opened) instead of wiping it.
  preserveInputs(bodyEl, () => {
    bodyEl.innerHTML = `
    <div class="main-post-wrapper ${postTheme}">
      <div class="disc-view-title">${esc(d.title)}</div>
      <div class="disc-view-meta">
        <strong>${esc(d.author)}</strong> · ${rel(d.postedAt)} · ${commentLabel}
      </div>
      ${d.image ? `<img src="${esc(d.image)}" class="disc-view-image" alt="">` : ""}
      <div class="disc-view-body">${renderWithLinks(d.body, esc)}</div>
    </div>
    <div class="comments-area">
      <div class="comments-title">${commentTitle}</div>
      ${commentsHtml}
      <div class="new-comment-box" style="margin-top:16px">
        <textarea class="new-comment-input" id="cmtInput"
          placeholder="${currentUser ? 'Join the discussion… type @ to mention someone' : 'Sign in to join the discussion'}"></textarea>
        <button class="btn-post-cmt" onclick="window.postComment()">Post</button>
      </div>
    </div>`;
  }, { keepOpenSelector: '[id^="reply-box-"]' });

  // Attach @mention listeners to the newly rendered comment/reply inputs
  attachMentionListeners();
}


// ─────────────────────────────────────────────
//  PIN / UNPIN
// ─────────────────────────────────────────────

async function togglePin(discId, alreadyPinned) {
  try {
    await togglePinWrite(discId, alreadyPinned);
    // The list's "Pinned" badge reads this set; it was only filled on first load.
    if (alreadyPinned) pinnedIds.delete(discId); else pinnedIds.add(discId);
  } catch (err) {
    console.error("Pin/unpin failed:", err);
    alert("Could not update the Bulletin. Please try again.");
  }
  renderDiscussionView();
}

async function togglePinWrite(discId, alreadyPinned) {
  if (alreadyPinned) {
    const snap = await get(ref(db, "bulletin"));
    const data = snap.val() || {};
    const entry = Object.entries(data).find(([, v]) => v.discussionId === discId || v.originalId === discId);
    if (entry) await remove(ref(db, `bulletin/${entry[0]}`));
  } else {
    const d = discussions[discId];
    if (!d) return;
    const commentCount = d.comments ? Object.keys(d.comments).length : 0;
    const name = getDisplayName();
    await set(push(ref(db, "bulletin")), {
      discussionId:   discId,
      originalId:     discId,
      type:           "floor",
      body:           d.body || "",
      author:         d.author,
      authorId:       d.authorId || null,
      authorInitials: d.authorInitials || "?",
      authorRole:     d.authorRole || "member",
      postedAt:       d.postedAt,
      commentCount,
      pinnedAt:       Date.now(),
      pinnedBy:       name
    });
  }
}


// ─────────────────────────────────────────────
//  PUBLISH DISCUSSION
// ─────────────────────────────────────────────

// One flag for the post/edit button: a second click while the first save is
// still in flight used to publish the same discussion twice.
let discussSaving = false;

async function handleMainButtonClick() {
  if (discussSaving) return;
  const btn = document.getElementById("mainSubmitBtn");
  const label = btn ? btn.innerText : "";
  discussSaving = true;
  if (btn) { btn.disabled = true; btn.innerText = isEditMode ? "Saving…" : "Publishing…"; }
  try {
    if (isEditMode) await saveEditDiscussion();
    else await publishDiscussion();
  } finally {
    discussSaving = false;
    // closeModal() resets the label on success; only restore it if still open.
    if (btn) {
      btn.disabled = false;
      if (document.getElementById("discussModal").classList.contains("open")) btn.innerText = label;
    }
  }
}

async function publishDiscussion() {
  if (!currentUser) return alert("Please sign in to post.");
  const body = document.getElementById("discContent").value.trim();
  if (!body) { document.getElementById("discContent").focus(); return; }

  // The picked image may still be compressing; wait so it isn't posted without it.
  if (attachedImagePromise) await attachedImagePromise;

  const name   = getDisplayName();
  const newRef = push(ref(db, "discussions"));
  try {
    await set(newRef, {
      body,
      author:         name,
      authorId:       currentUser.uid,
      authorRole:     userRole,
      authorInitials: name.substring(0, 2).toUpperCase(),
      image:          attachedImageData || null,
      postedAt:       Date.now()
    });
  } catch (err) {
    console.error("Publish discussion failed:", err);
    alert("Your post could not be published. Please try again.");
    return;
  }

  closeModal("discussModal");

  // Notify anyone @mentioned in the post (never blocks or undoes the post itself)
  await notifyMentions(body, 'a discussion post', newRef.key);
}


// ─────────────────────────────────────────────
//  PUBLISH POLL
// ─────────────────────────────────────────────

async function publishPoll() {
  if (!currentUser) return alert("Please log in to post a poll.");
  if (userRole !== "admin") { alert("Only Exec Board members can post polls."); return; }

  const question     = document.getElementById("pollQuestion").value.trim();
  const optionInputs = document.querySelectorAll("#pollOptionInputs .form-input");
  const options      = Array.from(optionInputs)
    .map(input => input.value.trim())
    .filter(label => label !== "")
    .map(label => ({ label, votes: 0 }));

  if (!question) return alert("Please enter a question.");
  if (options.length < 2) return alert("Please provide at least two valid options.");

  const name = getDisplayName();
  try {
    await set(push(ref(db, "polls")), {
      question, options,
      author:         name,
      authorInitials: name.substring(0, 2).toUpperCase(),
      authorId:       currentUser.uid,
      postedAt:       Date.now()
    });
    document.getElementById("pollQuestion").value = "";
    optionInputs.forEach(input => input.value = "");
    closeModal("pollModal");
    alert("Poll posted!");
  } catch (error) {
    console.error("Error publishing poll:", error);
    alert("You do not have permission to post polls.");
  }
}


// ─────────────────────────────────────────────
//  POLL OPTIONS (add / remove rows)
// ─────────────────────────────────────────────

function addPollOption() {
  const container = document.getElementById("pollOptionInputs");
  const newRow    = document.createElement("div");
  newRow.className = "poll-opt-row";
  newRow.innerHTML = `
    <input class="form-input" type="text" placeholder="New Option">
    <button class="remove-opt" onclick="window.removeOpt(this)" title="Remove">×</button>`;
  container.appendChild(newRow);
}

function removeOpt(btn) {
  const container = document.getElementById("pollOptionInputs");
  if (container.children.length > 2) btn.parentElement.remove();
  else alert("Polls must have at least two options.");
}


// ─────────────────────────────────────────────
//  EDIT / DELETE DISCUSSION
// ─────────────────────────────────────────────

function openEditModal() {
  const d = discussions[currentDiscId];
  if (!d) return;
  isEditMode = true;
  document.getElementById("discContent").value = d.body;
  const modalTitle = document.querySelector("#discussModal .modal-title");
  if (modalTitle) modalTitle.innerText = "Edit Discussion";
  const btn = document.getElementById("mainSubmitBtn");
  if (btn) btn.innerText = "Save Changes";
  openModal("discussModal");
}

async function saveEditDiscussion() {
  const body = document.getElementById("discContent").value.trim();
  if (!body) return;
  try {
    await update(ref(db, `discussions/${currentDiscId}`), { body, lastEdited: Date.now() });
    const snap = await get(ref(db, "bulletin"));
    const data = snap.val() || {};
    const entry = Object.entries(data).find(([, v]) => v.discussionId === currentDiscId || v.originalId === currentDiscId);
    if (entry) await update(ref(db, `bulletin/${entry[0]}`), { body });
    closeModal("discussModal");
    alert("Changes saved successfully!");
  } catch (error) {
    console.error("Firebase Error:", error);
    alert("Permission Denied: You can only edit your own posts.");
  }
}

async function deleteDiscussion() {
  if (!confirm("Delete this discussion?")) return;
  try {
    const snap = await get(ref(db, "bulletin"));
    const data = snap.val() || {};
    const entry = Object.entries(data).find(([, v]) => v.discussionId === currentDiscId || v.originalId === currentDiscId);
    if (entry) await remove(ref(db, `bulletin/${entry[0]}`));
    await softDelete('discussions', currentDiscId);
    // 'replace' so Back doesn't return to the post that was just deleted.
    showList({ history: 'replace' });
  } catch (err) {
    console.error("Delete discussion failed:", err);
    alert("This discussion could not be deleted. Please try again.");
  }
}


// ─────────────────────────────────────────────
//  DELETE POLL
// ─────────────────────────────────────────────

async function deletePoll(pollKey) {
  if (!currentUser || userRole !== "admin") return alert("Access Denied: Admins only.");
  if (confirm("Delete this poll permanently?")) {
    try {
      await remove(ref(db, `polls/${pollKey}`));
    } catch (error) {
      console.error("Error deleting poll:", error);
      alert("Failed to delete poll.");
    }
  }
}


// ─────────────────────────────────────────────
//  COMMENTS
// ─────────────────────────────────────────────

let commentSaving = false;

async function postComment() {
  if (!currentUser) return alert("Please sign in to comment.");
  const inp = document.getElementById("cmtInput");
  if (!inp || !inp.value.trim() || commentSaving) return;

  const text = inp.value.trim();
  const name = getDisplayName();
  const discId = currentDiscId;

  // Cleared before the write: the write re-renders this view (keeping any typed
  // text), so clearing afterwards would leave the sent comment in the box.
  inp.value = "";
  commentSaving = true;
  try {
    await set(push(ref(db, `discussions/${discId}/comments`)), {
      author:     name,
      authorId:   currentUser.uid,
      authorRole: userRole,
      initials:   name.substring(0, 2).toUpperCase(),
      text,
      postedAt:   Date.now()
    });
  } catch (err) {
    console.error("Post comment failed:", err);
    const box = document.getElementById("cmtInput");
    if (box && !box.value) box.value = text;
    alert("Your comment could not be posted. Please try again.");
    return;
  } finally {
    commentSaving = false;
  }

  // Notify anyone @mentioned in the comment
  await notifyMentions(text, 'a comment', discId);

  // Update bulletin comment count if pinned (best-effort: the comment is already saved)
  try {
    const snap = await get(ref(db, "bulletin"));
    const bulletinData = snap.val() || {};
    const entry = Object.entries(bulletinData).find(
      ([, v]) => v.discussionId === discId || v.originalId === discId
    );
    if (entry) {
      // Recount straight from the source of truth instead of the local cache,
      // which may already have been refreshed by the discussions listener by now.
      const commentsSnap = await get(ref(db, `discussions/${discId}/comments`));
      const newCount = commentsSnap.exists() ? Object.keys(commentsSnap.val()).length : 0;
      await update(ref(db, `bulletin/${entry[0]}`), { commentCount: newCount });
    }
  } catch (err) {
    console.warn("Could not update the pinned copy's comment count:", err);
  }
}

async function deleteComment(discKey, cmtKey) {
  if (!confirm("Delete this comment?")) return;
  try {
    await remove(ref(db, `discussions/${discKey}/comments/${cmtKey}`));
  } catch (err) {
    console.error("Delete comment failed:", err);
    alert("This comment could not be deleted. Please try again.");
  }
}


// ─────────────────────────────────────────────
//  NESTED REPLIES
// ─────────────────────────────────────────────

function toggleReplyBox(cmtId) {
  const box = document.getElementById(`reply-box-${cmtId}`);
  if (box) {
    box.style.display = box.style.display === "none" ? "block" : "none";
    // If just shown, attach @mention listener to the input
    if (box.style.display === "block") attachMentionListeners();
  }
}

const replySaving = new Set();

async function postReply(cmtId) {
  if (!currentUser) return alert("Please sign in to reply.");
  const inp = document.getElementById(`reply-input-${cmtId}`);
  if (!inp || !inp.value.trim() || replySaving.has(cmtId)) return;

  const text = inp.value.trim();
  const name = getDisplayName();
  const discId = currentDiscId;

  // Cleared before the write for the same reason as postComment().
  inp.value = "";
  replySaving.add(cmtId);
  try {
    await set(push(ref(db, `discussions/${discId}/comments/${cmtId}/replies`)), {
      author:     name,
      authorId:   currentUser.uid,
      authorRole: userRole,
      initials:   name.substring(0, 2).toUpperCase(),
      text,
      postedAt:   Date.now()
    });
  } catch (err) {
    console.error("Post reply failed:", err);
    const box = document.getElementById(`reply-input-${cmtId}`);
    if (box && !box.value) box.value = text;
    alert("Your reply could not be posted. Please try again.");
    return;
  } finally {
    replySaving.delete(cmtId);
  }

  // Notify anyone @mentioned in the reply
  await notifyMentions(text, 'a reply', discId);
}

async function deleteReply(discId, cmtId, replyId) {
  if (!confirm("Delete this reply?")) return;
  try {
    await remove(ref(db, `discussions/${discId}/comments/${cmtId}/replies/${replyId}`));
  } catch (err) {
    console.error("Delete reply failed:", err);
    alert("This reply could not be deleted. Please try again.");
  }
}


// ─────────────────────────────────────────────
//  POLLS RENDER
// ─────────────────────────────────────────────

function renderPolls() {
  const list = document.getElementById("pollsList");
  if (!list) return;

  const items = Object.entries(polls)
    .map(([key, val]) => ({ ...val, _key: key }))
    .sort((a, b) => b.postedAt - a.postedAt);

  if (!items.length) {
    list.innerHTML = `<div class="empty-state"><p class="empty-text">No polls yet.</p></div>`;
    return;
  }

  const isAdmin = userRole === "admin";

  list.innerHTML = items.map(p => {
    const options    = Array.isArray(p.options) ? p.options : [];
    const userVotes  = p.userVotes || {};
    const voteEntries = Object.values(userVotes);
    const totalVotes  = voteEntries.length;
    const myVoteIndex = currentUser ? userVotes[currentUser.uid] : null;
    const hasVoted    = myVoteIndex !== undefined && myVoteIndex !== null;

    const optionsHtml = options.map((o, i) => {
      const optionVotes = voteEntries.filter(v => v === i).length;
      const pct = totalVotes ? Math.round(optionVotes / totalVotes * 100) : 0;
      const isMyChoice = myVoteIndex === i;
      return `
        <div class="poll-option ${isMyChoice ? 'voted' : ''}" onclick="window.votePoll('${p._key}',${i})">
          <div class="poll-bar" style="width:${hasVoted ? pct : 0}%"></div>
          <div class="poll-option-content">
            <div class="poll-option-label">${isMyChoice ? '<strong>✓ </strong>' : ''}${esc(o.label)}</div>
            ${hasVoted ? `<span class="poll-pct">${pct}% (${optionVotes})</span>` : ""}
          </div>
        </div>`;
    }).join("");

    const deleteBtnHtml = isAdmin ? `
      <button onclick="window.deletePoll('${p._key}')" style="position:absolute;right:16px;top:16px;background:none;border:none;color:#ef4444;cursor:pointer;padding:4px;">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
      </button>` : "";

    return `
      <div class="poll-card" style="position:relative;">
        ${deleteBtnHtml}
        <div class="poll-title" style="padding-right:24px;">${esc(p.question)}</div>
        <div class="poll-options-container">${optionsHtml}</div>
        <div class="poll-footer" style="font-size:12px; color:#6b7280; margin-top:8px;">
          ${totalVotes} vote${totalVotes !== 1 ? 's' : ''} ${hasVoted ? '· You can click to change your vote' : ''}
        </div>
      </div>`;
  }).join("");
}

async function votePoll(pollKey, optIndex) {
  if (!currentUser) { alert("Please log in to vote."); return; }
  try {
    await set(ref(db, `polls/${pollKey}/userVotes/${currentUser.uid}`), optIndex);
    renderPolls();
  } catch (error) {
    console.error("Error voting:", error);
  }
}


// ─────────────────────────────────────────────
//  UI HELPERS
// ─────────────────────────────────────────────

function esc(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function rel(ts) {
  if (!ts) return "just now";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)    return "just now";
  if (s < 3600)  return Math.floor(s / 60) + " min ago";
  const n = s < 86400 ? Math.floor(s / 3600) : Math.floor(s / 86400);
  return `${n} ${s < 86400 ? 'hour' : 'day'}${n === 1 ? '' : 's'} ago`;
}

function showList({ history: historyMode = 'push' } = {}) {
  currentDiscId = null;
  syncPostUrl(null, historyMode);
  const vList = document.getElementById("viewList");
  const vDisc = document.getElementById("viewDiscussion");
  if (vList) vList.classList.add("active");
  if (vDisc) vDisc.classList.remove("active");
  renderDiscussions();
}

function showDiscussion(key, { history: historyMode = 'push' } = {}) {
  const switching = currentDiscId !== key;
  currentDiscId = key;
  syncPostUrl(key, historyMode);
  const vList = document.getElementById("viewList");
  const vDisc = document.getElementById("viewDiscussion");
  if (vList) vList.classList.remove("active");
  if (vDisc) vDisc.classList.add("active");
  renderDiscussionView();
  if (switching) window.scrollTo(0, 0);
}

function switchTab(tab) {
  document.getElementById("tabDiscussions").classList.toggle("active", tab === "discussions");
  document.getElementById("tabPolls").classList.toggle("active", tab === "polls");
  document.getElementById("panelDiscussions").style.display = tab === "discussions" ? "" : "none";
  document.getElementById("panelPolls").style.display       = tab === "polls"        ? "" : "none";
  const filterBar = document.getElementById("filterBar");
  if (filterBar) filterBar.style.display = tab === "discussions" ? "" : "none";
}

async function openModal(id) {
  // Signed-out visitors used to be able to write a whole post and only learn at
  // "Publish" that they had to sign in. Wait for Firebase to restore the session
  // first, so a signed-in member clicking right after page load isn't turned away.
  if (id === "discussModal" || id === "pollModal") {
    if (!auth.currentUser && typeof auth.authStateReady === "function") await auth.authStateReady();
    if (!auth.currentUser) {
      if (confirm("You need to sign in to post on The Floor. Go to the sign-in page?")) window.location.href = "auth.html";
      return;
    }
  }
  document.getElementById(id).classList.add("open");
}

function closeModal(id) {
  document.getElementById(id).classList.remove("open");
  if (id === "discussModal") {
    isEditMode = false;
    const modalTitle = document.querySelector("#discussModal .modal-title");
    if (modalTitle) modalTitle.innerText = "Start Discussion";
    const btn = document.getElementById("mainSubmitBtn");
    if (btn) btn.innerText = "Publish Discussion";
    document.getElementById("discContent").value = "";
    document.getElementById("attachPreview").textContent = "";
    // Reset the picker too; otherwise choosing the same image again fires no
    // change event and it can't be re-attached.
    const fileInput = document.getElementById("fileInput");
    if (fileInput) fileInput.value = "";
    attachedImageData = null;
    attachedImagePromise = null;
  }
}

// Floor images are stored inline in the database as base64, so every visitor
// downloads every image on every page load. Downscale before storing so one
// phone photo doesn't add several MB to /discussions.
const MAX_IMAGE_EDGE = 1280;
const IMAGE_QUALITY  = 0.8;
const MAX_GIF_BYTES  = 1.5 * 1024 * 1024;
let attachedImagePromise = null;

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function compressImage(file) {
  const original = await readAsDataUrl(file);

  // Canvas would flatten an animated GIF to one frame, so GIFs pass through as-is.
  if (file.type === "image/gif") {
    if (file.size > MAX_GIF_BYTES) {
      const err = new Error("GIFs must be under 1.5 MB. Please choose a smaller file.");
      err.userFacing = true;
      throw err;
    }
    return original;
  }

  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.onload  = () => resolve(el);
    el.onerror = reject;
    el.src = original;
  });

  const scale  = Math.min(1, MAX_IMAGE_EDGE / Math.max(img.width, img.height));
  const width  = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width  = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; // JPEG has no alpha: flatten transparent PNGs onto white
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  const compressed = canvas.toDataURL("image/jpeg", IMAGE_QUALITY);
  // Never make an already small, well-optimised file bigger.
  return compressed.length < original.length ? compressed : original;
}

function previewFile(input) {
  const file    = input.files[0];
  const preview = document.getElementById("attachPreview");
  attachedImageData = null;

  if (!file) {
    attachedImagePromise = null;
    preview.textContent = "";
    return;
  }

  preview.textContent = "Preparing image…";
  attachedImagePromise = compressImage(file)
    .then(data => {
      attachedImageData = data;
      preview.textContent = "📎 " + file.name;
    })
    .catch(err => {
      attachedImageData = null;
      input.value = "";
      preview.textContent = "";
      alert(err.userFacing ? err.message : "Couldn't read that image. Please try a different file.");
    });
}

function insertLink() {
  insertLinkAtCursor(document.getElementById("discContent"));
}


// ─────────────────────────────────────────────
//  EXPOSE TO GLOBAL
// ─────────────────────────────────────────────

Object.assign(window, {
  showList, showDiscussion, switchTab,
  openModal, closeModal, previewFile, insertLink,
  postComment, deleteComment,
  toggleReplyBox, postReply, deleteReply,
  publishDiscussion, deleteDiscussion,
  publishPoll, addPollOption, removeOpt, deletePoll,
  votePoll, openEditModal, handleMainButtonClick,
  togglePin
});