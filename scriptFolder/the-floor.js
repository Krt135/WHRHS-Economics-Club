// ─────────────────────────────────────────────
//  the-floor.js — Fully Integrated & Secure
// ─────────────────────────────────────────────

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import {
  getDatabase, ref, push, set, onValue, remove, update, get
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";
import {
  getAuth, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { firebaseConfig } from './config.js';

const app  = initializeApp(firebaseConfig);
const db   = getDatabase(app);
const auth = getAuth(app);

// ─────────────────────────────────────────────
//  STATE & AUTH TRACKING
// ─────────────────────────────────────────────

let currentUser       = null;
let userRole          = "public";
let userProfile       = null;
let discussions       = {};
let polls             = {};
let currentDiscId     = null;
let activeTag         = "all";
let attachedImageData = null;
let isEditMode        = false;

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
  if (currentDiscId) renderDiscussionView();
  renderDiscussions();
  renderPolls();
});

// ─────────────────────────────────────────────
//  UTILITIES
// ─────────────────────────────────────────────

const COLOURS = ["#0f1f3d","#1a2e52","#7c3aed","#0369a1","#065f46","#92400e"];
function avColour(name) {
  let h = 0;
  for (let c of (name || "")) h = (h * 31 + c.charCodeAt(0)) % COLOURS.length;
  return COLOURS[h];
}
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

// ─────────────────────────────────────────────
//  FIREBASE LISTENERS
// ─────────────────────────────────────────────

onValue(ref(db, "discussions"), snapshot => {
  discussions = snapshot.val() || {};
  if (currentDiscId) {
    if (discussions[currentDiscId]) renderDiscussionView();
    else showList();
  } else {
    renderDiscussions();
  }
});

onValue(ref(db, "polls"), snapshot => {
  polls = snapshot.val() || {};
  renderPolls();
});

// ─────────────────────────────────────────────
//  DEEP-LINK FROM BULLETIN
// ─────────────────────────────────────────────

window.addEventListener("DOMContentLoaded", () => {
  const targetId = sessionStorage.getItem("openDiscussion");
  if (targetId) {
    sessionStorage.removeItem("openDiscussion");
    const unsubscribe = onValue(ref(db, `discussions/${targetId}`), snapshot => {
      if (snapshot.exists()) {
        showDiscussion(targetId);
        unsubscribe();
      }
    });
  }
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

  if (activeTag !== "all") {
    items = items.filter(d => Array.isArray(d.tags) && d.tags.includes(activeTag));
  }

  if (!items.length) {
    list.innerHTML = `<div class="empty-state"><p class="empty-text">No discussions yet.</p></div>`;
    return;
  }

  list.innerHTML = items.map(d => {
    const commentCount = d.comments ? Object.keys(d.comments).length : 0;
    const tags = Array.isArray(d.tags) ? d.tags : [];
    return `
    <div class="disc-card" onclick="window.showDiscussion('${d._key}')">
      ${d.image ? `<img src="${esc(d.image)}" class="disc-image" alt="">` : ""}
      <div class="disc-title">${esc(d.title)}</div>
      <div class="disc-body">${esc(d.body)}</div>
      ${tags.length ? `<div class="disc-tags">${tags.map(t => `<span class="tag-pill">${esc(t)}</span>`).join("")}</div>` : ""}
      <div class="disc-meta">
        <span class="author">
          <span class="author-av" style="background:${avColour(d.author)}">${esc(d.authorInitials || "?")}</span>
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
  if (!d) return showList();

  const commentEntries = d.comments
    ? Object.entries(d.comments).map(([k, v]) => ({ ...v, _key: k })).sort((a, b) => a.postedAt - b.postedAt)
    : [];

  const canModify = currentUser && (d.authorId === currentUser.uid || userRole === "admin");
  const isAdmin   = userRole === "admin";

  // Async pin check — fills the topbar once resolved
  get(ref(db, "bulletin")).then(snap => {
    const bulletinData  = snap.val() || {};
    const alreadyPinned = Object.values(bulletinData).some(b => b.discussionId === currentDiscId);

    document.getElementById("discTopActions").innerHTML = `
      ${canModify ? `
        <button class="topbar-btn btn-edit-tb" onclick="window.openEditModal()">
          <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit
        </button>
        <button class="topbar-btn btn-del-tb" onclick="window.deleteDiscussion()">
          <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
          Delete
        </button>` : ""}
      ${isAdmin ? `
        <button class="topbar-btn btn-pin-tb ${alreadyPinned ? "pinned" : ""}" onclick="window.togglePin('${currentDiscId}', ${alreadyPinned})">
          <svg width="13" height="13" fill="${alreadyPinned ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
          ${alreadyPinned ? "Unpin" : "Pin to Bulletin"}
        </button>` : ""}`;
  });

  const commentsHtml = commentEntries.map(c => {
    const canDeleteComment = currentUser && (c.authorId === currentUser.uid || userRole === "admin");
    return `
    <div class="comment-item">
      <div class="comment-av" style="background:${avColour(c.author)}">${esc(c.initials || "?")}</div>
      <div class="comment-bubble">
        <div class="comment-hdr">
          <span class="comment-author">${esc(c.author)}</span>
          <span class="comment-time">${rel(c.postedAt)}</span>
        </div>
        <div class="comment-text">${esc(c.text)}</div>
        ${canDeleteComment ? `
          <div class="comment-acts">
            <button class="cmt-act cmt-del" onclick="deleteComment('${currentDiscId}','${c._key}')">Delete</button>
          </div>` : ""}
      </div>
    </div>`;
  }).join("");

  document.getElementById("discussionBody").innerHTML = `
    <div class="disc-view-title">${esc(d.title)}</div>
    <div class="disc-view-meta">
      <strong>${esc(d.author)}</strong> · ${rel(d.postedAt)} · ${commentEntries.length} comments
    </div>
    ${d.image ? `<img src="${esc(d.image)}" class="disc-view-image" alt="">` : ""}
    <div class="disc-view-body">${esc(d.body)}</div>
    <div class="comments-area">
      <div class="comments-title">${commentEntries.length} Comments</div>
      ${commentsHtml}
      <div class="new-comment-box" style="margin-top:16px">
        <textarea class="new-comment-input" id="cmtInput" placeholder="Join the discussion..."></textarea>
        <button class="btn-post-cmt" onclick="window.postComment()">Post</button>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────
//  PIN / UNPIN
// ─────────────────────────────────────────────

async function togglePin(discId, alreadyPinned) {
  if (alreadyPinned) {
    const snap = await get(ref(db, "bulletin"));
    const data = snap.val() || {};
    const entry = Object.entries(data).find(([, v]) => v.discussionId === discId);
    if (entry) await remove(ref(db, `bulletin/${entry[0]}`));
  } else {
    const d = discussions[discId];
    if (!d) return;
    const commentCount = d.comments ? Object.keys(d.comments).length : 0;
    const name = userProfile ? userProfile.email.split("@")[0] : currentUser.email.split("@")[0];
    await set(push(ref(db, "bulletin")), {
      discussionId:   discId,
      title:          d.title,
      body:           d.body || "",
      author:         d.author,
      authorInitials: d.authorInitials || "?",
      tags:           d.tags || [],
      postedAt:       d.postedAt,
      commentCount,
      pinnedAt:       Date.now(),
      pinnedBy:       name
    });
  }
  renderDiscussionView();
}

// ─────────────────────────────────────────────
//  PUBLISH DISCUSSION
// ─────────────────────────────────────────────

async function handleMainButtonClick() {
  if (isEditMode) await saveEditDiscussion();
  else await publishDiscussion();
}

async function publishDiscussion() {
  if (!currentUser) return alert("Please log in to post.");
  const title   = document.getElementById("discTitle").value.trim();
  const body    = document.getElementById("discContent").value.trim();
  const tagsRaw = document.getElementById("discTags").value.trim();
  if (!title) return;

  const name = userProfile ? userProfile.email.split("@")[0] : currentUser.email.split("@")[0];
  const tags = tagsRaw ? tagsRaw.split(",").map(t => t.trim()).filter(Boolean) : [];

  const newRef = push(ref(db, "discussions"));
  await set(newRef, {
    title, body, tags,
    author:         name,
    authorId:       currentUser.uid,
    authorInitials: name.substring(0, 2).toUpperCase(),
    image:          attachedImageData || null,
    postedAt:       Date.now()
  });

  closeModal("discussModal");
}

// ─────────────────────────────────────────────
//  PUBLISH POLL
// ─────────────────────────────────────────────

async function publishPoll() {
  if (!currentUser) return alert("Please log in to post a poll.");

  const question     = document.getElementById("pollQuestion").value.trim();
  const optionInputs = document.querySelectorAll("#pollOptionInputs .form-input");
  const options      = Array.from(optionInputs)
    .map(input => input.value.trim())
    .filter(label => label !== "")
    .map(label => ({ label, votes: 0 }));

  if (!question)          return alert("Please enter a question.");
  if (options.length < 2) return alert("Please provide at least two valid options.");

  try {
    await set(push(ref(db, "polls")), {
      question,
      options,
      authorId: currentUser.uid,
      postedAt: Date.now()
    });
    document.getElementById("pollQuestion").value = "";
    optionInputs.forEach(input => input.value = "");
    closeModal("pollModal");
  } catch (error) {
    console.error("Error publishing poll:", error);
    alert("System error. Please try again.");
  }
}

// ─────────────────────────────────────────────
//  POLL OPTIONS (add / remove rows in modal)
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
  if (container.children.length > 2) {
    btn.parentElement.remove();
  } else {
    alert("Polls must have at least two options.");
  }
}

// ─────────────────────────────────────────────
//  EDIT / DELETE DISCUSSION
// ─────────────────────────────────────────────

function openEditModal() {
  const d = discussions[currentDiscId];
  if (!d) return;
  isEditMode = true;

  document.getElementById("discTitle").value   = d.title;
  document.getElementById("discContent").value = d.body;
  if (d.tags) document.getElementById("discTags").value = d.tags.join(", ");

  const modalTitle = document.querySelector("#discussModal .modal-title");
  if (modalTitle) modalTitle.innerText = "Edit Discussion";

  const btn = document.getElementById("mainSubmitBtn");
  if (btn) btn.innerText = "Save Changes";

  openModal("discussModal");
}

async function saveEditDiscussion() {
  const title   = document.getElementById("discTitle").value.trim();
  const body    = document.getElementById("discContent").value.trim();
  const tagsRaw = document.getElementById("discTags").value.trim();
  if (!title || !body) return;
  const tags = tagsRaw ? tagsRaw.split(",").map(t => t.trim()).filter(Boolean) : [];

  try {
    await update(ref(db, `discussions/${currentDiscId}`), {
      title, body, tags, lastEdited: Date.now()
    });

    // Keep the bulletin snapshot in sync if pinned
    const snap  = await get(ref(db, "bulletin"));
    const data  = snap.val() || {};
    const entry = Object.entries(data).find(([, v]) => v.discussionId === currentDiscId);
    if (entry) await update(ref(db, `bulletin/${entry[0]}`), { title, body, tags });

    closeModal("discussModal");
    alert("Changes saved successfully!");
  } catch (error) {
    console.error("Firebase Error:", error);
    alert("Permission Denied: You can only edit your own posts.");
  }
}

async function deleteDiscussion() {
  if (confirm("Delete this discussion permanently?")) {
    // Remove from bulletin if pinned
    const snap  = await get(ref(db, "bulletin"));
    const data  = snap.val() || {};
    const entry = Object.entries(data).find(([, v]) => v.discussionId === currentDiscId);
    if (entry) await remove(ref(db, `bulletin/${entry[0]}`));

    await remove(ref(db, `discussions/${currentDiscId}`));
    showList();
  }
}

// ─────────────────────────────────────────────
//  DELETE POLL (admin only)
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

async function postComment() {
  if (!currentUser) return alert("Please log in to comment.");
  const inp = document.getElementById("cmtInput");
  if (!inp.value.trim()) return;

  const name = userProfile ? userProfile.email.split("@")[0] : currentUser.email.split("@")[0];
  await set(push(ref(db, `discussions/${currentDiscId}/comments`)), {
    author:   name,
    authorId: currentUser.uid,
    initials: name.substring(0, 2).toUpperCase(),
    text:     inp.value.trim(),
    postedAt: Date.now()
  });
  inp.value = "";

  // Keep bulletin comment count in sync
  const snap        = await get(ref(db, "bulletin"));
  const bulletinData = snap.val() || {};
  const entry       = Object.entries(bulletinData).find(([, v]) => v.discussionId === currentDiscId);
  if (entry) {
    const d        = discussions[currentDiscId];
    const newCount = d && d.comments ? Object.keys(d.comments).length + 1 : 1;
    await update(ref(db, `bulletin/${entry[0]}`), { commentCount: newCount });
  }
}

async function deleteComment(discKey, cmtKey) {
  if (confirm("Delete this comment?")) {
    await remove(ref(db, `discussions/${discKey}/comments/${cmtKey}`));
  }
}

// ─────────────────────────────────────────────
//  FILTER
// ─────────────────────────────────────────────

function filterByTag(btn, tag) {
  activeTag = tag;
  document.querySelectorAll(".filter-tag").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  renderDiscussions();
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
    const totalVotes = options.reduce((a, o) => a + (o.votes || 0), 0);
    const hasVoted   = localStorage.getItem(`voted_${p._key}`) !== null;

    const optionsHtml = options.map((o, i) => {
      const pct = totalVotes ? Math.round((o.votes || 0) / totalVotes * 100) : 0;
      return `
        <div class="poll-option" onclick="window.votePoll('${p._key}',${i})">
          <div class="poll-bar" style="width:${hasVoted ? pct : 0}%"></div>
          <div class="poll-option-content">
            <div class="poll-option-label">${esc(o.label)}</div>
            ${hasVoted ? `<span class="poll-pct">${pct}%</span>` : ""}
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
        ${optionsHtml}
      </div>`;
  }).join("");
}

async function votePoll(pollKey, optIndex) {
  if (localStorage.getItem(`voted_${pollKey}`)) return;
  const p = polls[pollKey];
  const options = [...p.options];
  options[optIndex].votes = (options[optIndex].votes || 0) + 1;
  localStorage.setItem(`voted_${pollKey}`, optIndex);
  await update(ref(db, `polls/${pollKey}`), { options });
  renderPolls();
}

// ─────────────────────────────────────────────
//  UI HELPERS
// ─────────────────────────────────────────────

function showList() {
  currentDiscId = null;
  document.getElementById("viewList").classList.add("active");
  document.getElementById("viewDiscussion").classList.remove("active");
  renderDiscussions();
}

function showDiscussion(key) {
  currentDiscId = key;
  document.getElementById("viewList").classList.remove("active");
  document.getElementById("viewDiscussion").classList.add("active");
  renderDiscussionView();
}

function switchTab(tab) {
  document.getElementById("tabDiscussions").classList.toggle("active", tab === "discussions");
  document.getElementById("tabPolls").classList.toggle("active", tab === "polls");
  document.getElementById("panelDiscussions").style.display = tab === "discussions" ? "" : "none";
  document.getElementById("panelPolls").style.display       = tab === "polls"       ? "" : "none";
  const filterBar = document.getElementById("filterBar");
  if (filterBar) filterBar.style.display = tab === "discussions" ? "" : "none";
}

function openModal(id)  { document.getElementById(id).classList.add("open"); }

function closeModal(id) {
  document.getElementById(id).classList.remove("open");
  if (id === "discussModal") {
    isEditMode = false;
    const modalTitle = document.querySelector("#discussModal .modal-title");
    if (modalTitle) modalTitle.innerText = "Start Discussion";
    const btn = document.getElementById("mainSubmitBtn");
    if (btn) btn.innerText = "Publish Discussion";
    document.getElementById("discTitle").value   = "";
    document.getElementById("discContent").value = "";
    document.getElementById("discTags").value    = "";
    document.getElementById("attachPreview").textContent = "";
    attachedImageData = null;
  }
}

function previewFile(input) {
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = e => {
    attachedImageData = e.target.result;
    document.getElementById("attachPreview").textContent = "📎 " + file.name;
  };
  if (file) reader.readAsDataURL(file);
}

// ─────────────────────────────────────────────
//  EXPOSE TO GLOBAL
// ─────────────────────────────────────────────

Object.assign(window, {
  showList, showDiscussion, switchTab,
  openModal, closeModal, previewFile,
  postComment, deleteComment,
  publishDiscussion, deleteDiscussion,
  publishPoll, addPollOption, removeOpt, deletePoll,
  votePoll, openEditModal, handleMainButtonClick,
  filterByTag, togglePin
});