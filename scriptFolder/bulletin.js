// ─────────────────────────────────────────────
//  bulletin.js
// ─────────────────────────────────────────────

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, onValue, remove, get } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { firebaseConfig } from './config.js';

const app  = initializeApp(firebaseConfig);
const db   = getDatabase(app);
const auth = getAuth(app);

// ─────────────────────────────────────────────
//  AUTH STATE
// ─────────────────────────────────────────────

let currentUser = null;
let userRole    = "public";
let userProfile = null;

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    const snapshot = await get(ref(db, `users/${user.uid}`));
    if (snapshot.exists()) {
      userProfile = snapshot.val();
      userRole    = userProfile.role || "member";
    }
  } else {
    currentUser = null;
    userRole    = "public";
    userProfile = null;
  }
  renderBulletin();
});

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────

function esc(s) {
  return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function rel(ts) {
  if (!ts) return "just now";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)    return "just now";
  if (s < 3600)  return Math.floor(s / 60)   + " min ago";
  if (s < 86400) return Math.floor(s / 3600) + " hours ago";
  return Math.floor(s / 86400) + " days ago";
}

const COLOURS = ["#0f1f3d","#1a2e52","#7c3aed","#0369a1","#065f46","#92400e"];
function avColour(name) {
  let h = 0;
  for (let c of (name || "")) h = (h * 31 + c.charCodeAt(0)) % COLOURS.length;
  return COLOURS[h];
}

// ─────────────────────────────────────────────
//  FIREBASE LISTENER
//  bulletin/{id} stores: { discussionId, title, author,
//    authorInitials, body, tags, pinnedAt, pinnedBy }
// ─────────────────────────────────────────────

let bulletinItems = [];

onValue(ref(db, "bulletin"), snapshot => {
  const data = snapshot.val() || {};
  bulletinItems = Object.entries(data)
    .map(([key, val]) => ({ ...val, _key: key }))
    .sort((a, b) => b.pinnedAt - a.pinnedAt);
  renderBulletin();
});

// ─────────────────────────────────────────────
//  RENDER
// ─────────────────────────────────────────────

function renderBulletin() {
  const el = document.getElementById("bulletinList");
  if (!el) return;

  const isAdmin = userRole === "admin";

  if (!bulletinItems.length) {
    el.innerHTML = `
      <div class="empty-state">
        <p class="empty-italic">The Bulletin is empty.</p>
        <p class="empty-sub">Exec members can pin important posts and polls from any section.</p>
      </div>`;
    return;
  }

  el.innerHTML = bulletinItems.map(item => {
    const tags = Array.isArray(item.tags) ? item.tags : [];
    const commentCount = item.commentCount || 0;
    return `
    <div class="bulletin-card" onclick="goToDiscussion('${esc(item.discussionId)}')">
      <div class="bc-pin-label">
        <svg width="11" height="11" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
        PINNED BY EXEC BOARD · ${rel(item.pinnedAt)}
      </div>
      <div class="bc-title">${esc(item.title)}</div>
      <div class="bc-body">${esc((item.body || "").slice(0, 200))}${(item.body || "").length > 200 ? "…" : ""}</div>
      ${tags.length ? `<div class="bc-tags">${tags.map(t => `<span class="tag-pill">${esc(t)}</span>`).join("")}</div>` : ""}
      <div class="bc-meta">
        <span class="author-chip">
          <span class="author-av" style="background:${avColour(item.author)}">${esc(item.authorInitials || "?")}</span>
          ${esc(item.author)}
        </span>
        <span>·</span>
        <span>${rel(item.postedAt)}</span>
        <span>·</span>
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        ${commentCount}
        <span class="bc-goto">Read discussion →</span>
      </div>
      ${isAdmin ? `
      <div class="bc-admin-row" onclick="event.stopPropagation()">
        <button class="bc-unpin-btn" onclick="unpinPost('${esc(item._key)}')">
          <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
          Unpin
        </button>
      </div>` : ""}
    </div>`;
  }).join("");
}

// ─────────────────────────────────────────────
//  NAVIGATION — click a card → go to the-floor
//  We store the target discussion ID in sessionStorage
//  so the-floor.js can open it directly on load.
// ─────────────────────────────────────────────

function goToDiscussion(discussionId) {
  sessionStorage.setItem("openDiscussion", discussionId);
  window.location.href = "the-floor.html";
}

// ─────────────────────────────────────────────
//  UNPIN (admin only)
// ─────────────────────────────────────────────

async function unpinPost(bulletinKey) {
  if (!confirm("Unpin this post from the Bulletin?")) return;
  await remove(ref(db, `bulletin/${bulletinKey}`));
}

// ─────────────────────────────────────────────
//  EXPOSE
// ─────────────────────────────────────────────

Object.assign(window, { goToDiscussion, unpinPost });
