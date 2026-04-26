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

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// ─────────────────────────────────────────────
//  STATE & AUTH TRACKING
// ─────────────────────────────────────────────

let currentUser = null;
let userRole = "public";
let userProfile = null;
let discussions = {};
let polls = {};
let activeTag = "all";
let attachedImageData = null;
let isEditMode = false;

// Check for deep links from Bulletin (Check both potential keys to be safe)
let currentDiscId = sessionStorage.getItem("openFloorPost") || sessionStorage.getItem("openDiscussion") || null;

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    const snapshot = await get(ref(db, `users/${user.uid}`));
    if (snapshot.exists()) {
      userProfile = snapshot.val();
      userRole = userProfile.role || "member";
    }
  } else {
    currentUser = null;
    userRole = "public";
    userProfile = null;
  }

  const pollBtn = document.getElementById("openPollModalBtn");
  if (pollBtn) {
    pollBtn.style.display = (userRole === "admin") ? "block" : "none";
  }

  // Initial render based on state
  if (currentDiscId) {
    showDiscussion(currentDiscId);
  } else {
    renderDiscussions();
  }
  renderPolls();
});

// ─────────────────────────────────────────────
//  UTILITIES
// ─────────────────────────────────────────────

function getDisplayName() {
  if (userProfile && userProfile.displayName) {
    return userProfile.displayName;
  }
  if (currentUser && currentUser.email) {
    return currentUser.email.split("@")[0];
  }
  return "Member";
}

const COLOURS = ["#0f1f3d", "#1a2e52", "#7c3aed", "#0369a1", "#065f46", "#92400e"];
function avColour(name) {
  let h = 0;
  for (let c of (name || "")) h = (h * 31 + c.charCodeAt(0)) % COLOURS.length;
  return COLOURS[h];
}
function esc(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function rel(ts) {
  if (!ts) return "just now";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + " min ago";
  if (s < 86400) return Math.floor(s / 3600) + " hours ago";
  return Math.floor(s / 86400) + " days ago";
}

// ─────────────────────────────────────────────
//  FIREBASE LISTENERS
// ─────────────────────────────────────────────

onValue(ref(db, "discussions"), snapshot => {
  discussions = snapshot.val() || {};

  // CHECK FOR REDIRECT FROM BULLETIN
  if (currentDiscId) {
    if (discussions[currentDiscId]) {
      // Clear session storage so it doesn't trap the user on refresh
      sessionStorage.removeItem("openFloorPost");
      sessionStorage.removeItem("openDiscussion");
      showDiscussion(currentDiscId);
    } else {
      console.warn("Discussion not found, defaulting to list.");
      currentDiscId = null;
      showList();
    }
  } else {
    renderDiscussions();
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

    let cardTheme = "theme-member";
    if (currentUser && d.authorId === currentUser.uid) {
      cardTheme = "theme-me";
    } else if (d.authorRole === "admin") {
      cardTheme = "theme-exec";
    }

    return `
    <div class="disc-card ${cardTheme}" onclick="window.showDiscussion('${d._key}')">
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

// ─────────────────────────────────────────────
//  RENDER — SINGLE DISCUSSION VIEW
// ─────────────────────────────────────────────

function renderDiscussionView() {
  const d = discussions[currentDiscId];

  if (!d) {
    showList();
    return;
  }

  const commentEntries = d.comments
    ? Object.entries(d.comments).map(([k, v]) => ({ ...v, _key: k })).sort((a, b) => a.postedAt - b.postedAt)
    : [];

  const canModify = currentUser && (d.authorId === currentUser.uid || userRole === "admin");
  const isAdmin = userRole === "admin";

  get(ref(db, "bulletin")).then(snap => {
    const bulletinData = snap.val() || {};
    const alreadyPinned = Object.values(bulletinData).some(b => b.discussionId === currentDiscId || b.originalId === currentDiscId);

    const topActions = document.getElementById("discTopActions");
    if (topActions) {
      topActions.innerHTML = `
        ${canModify ? `
          <button class="topbar-btn btn-edit-tb" onclick="window.openEditModal()">Edit</button>
          <button class="topbar-btn btn-del-tb" onclick="window.deleteDiscussion()">Delete</button>` : ""}
        ${isAdmin ? `
          <button class="topbar-btn btn-pin-tb ${alreadyPinned ? "pinned" : ""}" onclick="window.togglePin('${currentDiscId}', ${alreadyPinned})">
            ${alreadyPinned ? "Unpin" : "Pin to Bulletin"}
          </button>` : ""}`;
    }
  });

  let postTheme = "theme-member";
  if (currentUser && d.authorId === currentUser.uid) { postTheme = "theme-me"; }
  else if (d.authorRole === "admin") { postTheme = "theme-exec"; }

  const commentsHtml = commentEntries.map(c => {
    const canDeleteComment = currentUser && (c.authorId === currentUser.uid || userRole === "admin");
    let cmtTheme = (currentUser && c.authorId === currentUser.uid) ? "theme-me" : (c.authorRole === "admin" ? "theme-exec" : "theme-member");

    // --- NEW: Handle Nested Replies ---
    const replies = c.replies ? Object.entries(c.replies).map(([rk, rv]) => ({ ...rv, _key: rk })).sort((a, b) => a.postedAt - b.postedAt) : [];

    const repliesHtml = replies.map(r => {
      const canDeleteReply = currentUser && (r.authorId === currentUser.uid || userRole === "admin");
      return `
        <div class="reply-item" style="display:flex; gap:8px; margin-top:12px;">
          <div class="comment-av" style="background:${avColour(r.author)}; width:24px; height:24px; font-size:10px;">${esc(r.initials || "?")}</div>
          <div class="comment-bubble" style="flex:1;">
            <div class="comment-hdr">
              <span class="comment-author">${esc(r.author)}</span>
              <span class="comment-time">${rel(r.postedAt)}</span>
            </div>
            <div class="comment-text">${esc(r.text)}</div>
            ${canDeleteReply ? `
              <div class="comment-acts">
                <button class="cmt-act cmt-del" onclick="deleteReply('${currentDiscId}','${c._key}','${r._key}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="3 6 5 6 21 6"></polyline>
  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  <line x1="10" y1="11" x2="10" y2="17"></line>
  <line x1="14" y1="11" x2="14" y2="17"></line>
</svg>Delete</button>
              </div>` : ""}
          </div>
        </div>
      `;
    }).join("");

    return `
    <div class="comment-item ${cmtTheme}">
      <div class="comment-av" style="background:${avColour(c.author)}">${esc(c.initials || "?")}</div>
      <div class="comment-bubble">
        <div class="comment-hdr">
          <span class="comment-author">${esc(c.author)}</span>
          <span class="comment-time">${rel(c.postedAt)}</span>
        </div>
        <div class="comment-text">${esc(c.text)}</div>
        
        <div class="comment-acts">
          <button class="cmt-act" onclick="window.toggleReplyBox('${c._key}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="9 17 4 12 9 7"></polyline>
  <path d="M20 18v-2a4 4 0 0 0-4-4H4"></path>
</svg>Reply</button>
          ${canDeleteComment ? `<button class="cmt-act cmt-del" onclick="deleteComment('${currentDiscId}','${c._key}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="3 6 5 6 21 6"></polyline>
  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  <line x1="10" y1="11" x2="10" y2="17"></line>
  <line x1="14" y1="11" x2="14" y2="17"></line>
</svg>
Delete</button>` : ""}
        </div>

        ${replies.length > 0 ? `<div style="margin-left:8px; padding-left:12px; border-left:2px solid #e5e7eb;">${repliesHtml}</div>` : ""}

        <div id="reply-box-${c._key}" style="display:none; margin-top:12px; margin-left:8px; padding-left:12px; border-left:2px solid #e5e7eb;">
          <div style="display:flex; gap:8px;">
            <input type="text" id="reply-input-${c._key}" class="new-comment-input" placeholder="Write a reply..." style="min-height:36px; height:36px;">
            <button class="btn-post-cmt" onclick="window.postReply('${c._key}')">Post</button>
          </div>
        </div>
      </div>
    </div>`;
  }).join("");

  document.getElementById("discussionBody").innerHTML = `
    <div class="main-post-wrapper ${postTheme}">
      <div class="disc-view-title">${esc(d.title)}</div>
      <div class="disc-view-meta">
        <strong>${esc(d.author)}</strong> · ${rel(d.postedAt)} · ${commentEntries.length} comments
      </div>
      ${d.image ? `<img src="${esc(d.image)}" class="disc-view-image" alt="">` : ""}
      <div class="disc-view-body">${esc(d.body)}</div>
    </div>
    
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
    const entry = Object.entries(data).find(([, v]) => v.discussionId === discId || v.originalId === discId);
    if (entry) await remove(ref(db, `bulletin/${entry[0]}`));
  } else {
    const d = discussions[discId];
    if (!d) return;
    const commentCount = d.comments ? Object.keys(d.comments).length : 0;

    const name = getDisplayName();

    await set(push(ref(db, "bulletin")), {
      discussionId: discId, // Included for backwards compatibility 
      originalId: discId, // The new standard
      type: "floor", // Tells bulletin.js it's a floor post
      body: d.body || "",
      author: d.author,
      authorInitials: d.authorInitials || "?",
      tags: d.tags || [],
      postedAt: d.postedAt,
      commentCount,
      pinnedAt: Date.now(),
      pinnedBy: name
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
  const body = document.getElementById("discContent").value.trim();
  const tagsRaw = document.getElementById("discTags").value.trim();
  if (!body) return;

  const name = getDisplayName();
  const tags = tagsRaw ? tagsRaw.split(",").map(t => t.trim()).filter(Boolean) : [];

  const newRef = push(ref(db, "discussions"));
  await set(newRef, {
    body, tags,
    author: name,
    authorId: currentUser.uid,
    authorRole: userRole,
    authorInitials: name.substring(0, 2).toUpperCase(),
    image: attachedImageData || null,
    postedAt: Date.now()
  });

  closeModal("discussModal");
}

// ─────────────────────────────────────────────
//  PUBLISH POLL
// ─────────────────────────────────────────────

async function publishPoll() {
  if (!currentUser) return alert("Please log in to post a poll.");

  if (userRole !== "admin") {
    alert("Only Exec Board members can post polls.");
    return;
  }

  const question = document.getElementById("pollQuestion").value.trim();
  const optionInputs = document.querySelectorAll("#pollOptionInputs .form-input");
  const options = Array.from(optionInputs)
    .map(input => input.value.trim())
    .filter(label => label !== "")
    .map(label => ({ label, votes: 0 }));

  if (!question) return alert("Please enter a question.");
  if (options.length < 2) return alert("Please provide at least two valid options.");

  const name = getDisplayName();

  try {
    await set(push(ref(db, "polls")), {
      question,
      options,
      author: name,
      authorInitials: name.substring(0, 2).toUpperCase(),
      authorId: currentUser.uid,
      postedAt: Date.now()
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
//  POLL OPTIONS (add / remove rows in modal)
// ─────────────────────────────────────────────

function addPollOption() {
  const container = document.getElementById("pollOptionInputs");
  const newRow = document.createElement("div");
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

  document.getElementById("discContent").value = d.body;
  if (d.tags) document.getElementById("discTags").value = d.tags.join(", ");

  const modalTitle = document.querySelector("#discussModal .modal-title");
  if (modalTitle) modalTitle.innerText = "Edit Discussion";

  const btn = document.getElementById("mainSubmitBtn");
  if (btn) btn.innerText = "Save Changes";

  openModal("discussModal");
}

async function saveEditDiscussion() {
  const body = document.getElementById("discContent").value.trim();
  const tagsRaw = document.getElementById("discTags").value.trim();
  if (!body) return;
  const tags = tagsRaw ? tagsRaw.split(",").map(t => t.trim()).filter(Boolean) : [];

  try {
    await update(ref(db, `discussions/${currentDiscId}`), {
      body, tags, lastEdited: Date.now()
    });

    const snap = await get(ref(db, "bulletin"));
    const data = snap.val() || {};
    const entry = Object.entries(data).find(([, v]) => v.discussionId === currentDiscId || v.originalId === currentDiscId);
    if (entry) await update(ref(db, `bulletin/${entry[0]}`), { body, tags });

    closeModal("discussModal");
    alert("Changes saved successfully!");
  } catch (error) {
    console.error("Firebase Error:", error);
    alert("Permission Denied: You can only edit your own posts.");
  }
}

async function deleteDiscussion() {
  if (confirm("Delete this discussion permanently?")) {
    const snap = await get(ref(db, "bulletin"));
    const data = snap.val() || {};
    const entry = Object.entries(data).find(([, v]) => v.discussionId === currentDiscId || v.originalId === currentDiscId);
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

  const name = getDisplayName();

  await set(push(ref(db, `discussions/${currentDiscId}/comments`)), {
    author: name,
    authorId: currentUser.uid,
    authorRole: userRole,
    initials: name.substring(0, 2).toUpperCase(),
    text: inp.value.trim(),
    postedAt: Date.now()
  });
  inp.value = "";

  const snap = await get(ref(db, "bulletin"));
  const bulletinData = snap.val() || {};
  const entry = Object.entries(bulletinData).find(([, v]) => v.discussionId === currentDiscId || v.originalId === currentDiscId);
  if (entry) {
    const d = discussions[currentDiscId];
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
//  NESTED REPLIES
// ─────────────────────────────────────────────

function toggleReplyBox(cmtId) {
  const box = document.getElementById(`reply-box-${cmtId}`);
  if (box) {
    box.style.display = box.style.display === "none" ? "block" : "none";
  }
}

async function postReply(cmtId) {
  if (!currentUser) return alert("Please log in to reply.");
  const inp = document.getElementById(`reply-input-${cmtId}`);
  if (!inp.value.trim()) return;

  const name = getDisplayName();

  // Push the reply into a sub-folder of the specific comment
  await set(push(ref(db, `discussions/${currentDiscId}/comments/${cmtId}/replies`)), {
    author: name,
    authorId: currentUser.uid,
    authorRole: userRole,
    initials: name.substring(0, 2).toUpperCase(),
    text: inp.value.trim(),
    postedAt: Date.now()
  });

  inp.value = "";
}

async function deleteReply(discId, cmtId, replyId) {
  if (confirm("Delete this reply?")) {
    await remove(ref(db, `discussions/${discId}/comments/${cmtId}/replies/${replyId}`));
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
    const options = Array.isArray(p.options) ? p.options : [];

    const userVotes = p.userVotes || {};
    const voteEntries = Object.values(userVotes);
    const totalVotes = voteEntries.length;

    const myVoteIndex = currentUser ? userVotes[currentUser.uid] : null;
    const hasVoted = myVoteIndex !== undefined && myVoteIndex !== null;

    const optionsHtml = options.map((o, i) => {
      const optionVotes = voteEntries.filter(v => v === i).length;
      const pct = totalVotes ? Math.round(optionVotes / totalVotes * 100) : 0;
      const isMyChoice = myVoteIndex === i;

      return `
        <div class="poll-option ${isMyChoice ? 'voted' : ''}" onclick="window.votePoll('${p._key}',${i})">
          <div class="poll-bar" style="width:${hasVoted ? pct : 0}%"></div>
          <div class="poll-option-content">
            <div class="poll-option-label">
              ${isMyChoice ? '<strong>✓ </strong>' : ''}${esc(o.label)}
            </div>
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
        <div class="poll-options-container">
          ${optionsHtml}
        </div>
        <div class="poll-footer" style="font-size:12px; color:#6b7280; margin-top:8px;">
          ${totalVotes} vote${totalVotes !== 1 ? 's' : ''} ${hasVoted ? '· You can click to change your vote' : ''}
        </div>
      </div>`;
  }).join("");
}

async function votePoll(pollKey, optIndex) {
  if (!currentUser) {
    alert("Please log in to vote.");
    return;
  }

  const uid = currentUser.uid;
  const userVoteRef = ref(db, `polls/${pollKey}/userVotes/${uid}`);

  try {
    await set(userVoteRef, optIndex);
    console.log("Vote updated successfully!");
    renderPolls();
  } catch (error) {
    console.error("Error voting:", error);
  }
}

// ─────────────────────────────────────────────
//  UI HELPERS
// ─────────────────────────────────────────────

function showList() {
  currentDiscId = null;
  // Make sure these IDs match what is in your HTML (e.g. id="viewList" and id="viewDiscussion")
  const vList = document.getElementById("viewList");
  const vDisc = document.getElementById("viewDiscussion");

  if (vList) vList.classList.add("active");
  if (vDisc) vDisc.classList.remove("active");
  renderDiscussions();
}

function showDiscussion(key) {
  currentDiscId = key;
  const vList = document.getElementById("viewList");
  const vDisc = document.getElementById("viewDiscussion");

  if (vList) vList.classList.remove("active");
  if (vDisc) vDisc.classList.add("active");
  renderDiscussionView();
}

function switchTab(tab) {
  document.getElementById("tabDiscussions").classList.toggle("active", tab === "discussions");
  document.getElementById("tabPolls").classList.toggle("active", tab === "polls");
  document.getElementById("panelDiscussions").style.display = tab === "discussions" ? "" : "none";
  document.getElementById("panelPolls").style.display = tab === "polls" ? "" : "none";
  const filterBar = document.getElementById("filterBar");
  if (filterBar) filterBar.style.display = tab === "discussions" ? "" : "none";
}

function openModal(id) { document.getElementById(id).classList.add("open"); }

function closeModal(id) {
  document.getElementById(id).classList.remove("open");
  if (id === "discussModal") {
    isEditMode = false;
    const modalTitle = document.querySelector("#discussModal .modal-title");
    if (modalTitle) modalTitle.innerText = "Start Discussion";
    const btn = document.getElementById("mainSubmitBtn");
    if (btn) btn.innerText = "Publish Discussion";
    document.getElementById("discContent").value = "";
    document.getElementById("discTags").value = "";
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
  toggleReplyBox, postReply, deleteReply,
  publishDiscussion, deleteDiscussion,
  publishPoll, addPollOption, removeOpt, deletePoll,
  votePoll, openEditModal, handleMainButtonClick,
  togglePin
});