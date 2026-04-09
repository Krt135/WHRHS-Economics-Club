// ─────────────────────────────────────────────
//  the-floor.js  —  Firebase Realtime Database
// ─────────────────────────────────────────────

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import {
  getDatabase, ref, push, set, onValue, remove, update
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";
import { firebaseConfig } from './app.js'; 

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

// ─────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────

const CURRENT_USER = { name: "Kartikeya Pant", initials: "KP" };

const COLOURS = ["#0f1f3d","#1a2e52","#7c3aed","#0369a1","#065f46","#92400e"];
function avColour(name) {
  let h = 0;
  for (let c of name) h = (h * 31 + c.charCodeAt(0)) % COLOURS.length;
  return COLOURS[h];
}

// ─────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────

let discussions   = {}; 
let polls         = {}; 
let currentDiscId = null; 
let activeTag     = "all";
let attachedImageData = null;

// ─────────────────────────────────────────────
//  UTILS
// ─────────────────────────────────────────────

function esc(s) {
  return String(s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function rel(ts) {
  if (!ts) return "just now";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)    return "just now";
  if (s < 3600)  return Math.floor(s / 60)    + " min ago";
  if (s < 86400) return Math.floor(s / 3600)  + " hours ago";
  return              Math.floor(s / 86400) + " days ago";
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
//  VIEWS
// ─────────────────────────────────────────────

function showList() {
  currentDiscId = null;
  document.getElementById("viewList").classList.add("active");
  document.getElementById("viewDiscussion").classList.remove("active");
  renderDiscussions();
}

function showDiscussion(firebaseKey) {
  currentDiscId = firebaseKey;
  document.getElementById("viewList").classList.remove("active");
  document.getElementById("viewDiscussion").classList.add("active");
  renderDiscussionView();
}

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
    list.innerHTML = `<div class="empty-state"><p class="empty-text">No discussions yet. Be the first to start one!</p></div>`;
    return;
  }

  list.innerHTML = items.map(d => {
    const commentCount = d.comments ? Object.keys(d.comments).length : 0;
    const tags = Array.isArray(d.tags) ? d.tags : [];
    return `
    <div class="disc-card" onclick="window.showDiscussion('${d._key}')">
      ${d.image ? `<img src="${esc(d.image)}" class="disc-image" alt="Attached image">` : ""}
      <div class="disc-title">${esc(d.title)}</div>
      <div class="disc-body">${esc(d.body)}</div>
      ${tags.length ? `<div class="disc-tags">${tags.map(t => `<span class="tag-pill">${esc(t)}</span>`).join("")}</div>` : ""}
      <div class="disc-meta">
        <span class="author">
          <span class="author-av" style="background:${avColour(d.author||'')}">${esc(d.authorInitials||"?")}</span>
          ${esc(d.author||"")}
        </span>
        <span>·</span>
        <span>${rel(d.postedAt)}</span>
        <span>·</span>
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        ${commentCount}
      </div>
      <div class="disc-actions" onclick="event.stopPropagation()">
        <button class="action-btn ${d.liked ? "liked" : ""}" onclick="reactDisc('${d._key}','like')">
          <svg width="14" height="14" fill="${d.liked ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>
          ${d.likes || 0}
        </button>
        <button class="action-btn ${d.disliked ? "disliked" : ""}" onclick="reactDisc('${d._key}','dislike')">
          <svg width="14" height="14" fill="${d.disliked ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"/></svg>
          ${d.dislikes || 0}
        </button>
        <button class="action-btn" onclick="window.showDiscussion('${d._key}')">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          ${commentCount}
        </button>
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

  const tags = Array.isArray(d.tags) ? d.tags : [];
  const commentEntries = d.comments
    ? Object.entries(d.comments)
        .map(([k, v]) => ({ ...v, _key: k }))
        .sort((a, b) => a.postedAt - b.postedAt)
    : [];

  const isAuthor = d.author === CURRENT_USER.name;

  document.getElementById("discTopActions").innerHTML = isAuthor ? `
    <button class="topbar-btn btn-del-tb" onclick="window.deleteDiscussion()">
      <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
      Delete
    </button>` : "";

  const commentsHtml = commentEntries.length
    ? commentEntries.map(c => `
        <div class="comment-item">
          <div class="comment-av" style="background:${avColour(c.author||"")}">${esc(c.initials||"?")}</div>
          <div class="comment-bubble">
            <div class="comment-hdr">
              <span class="comment-author">${esc(c.author||"")}</span>
              <span class="comment-time">${rel(c.postedAt)}</span>
            </div>
            <div class="comment-text">${esc(c.text)}</div>
            <div class="comment-acts">
              <button class="cmt-act ${c.liked ? "liked" : ""}"
                onclick="likeComment('${currentDiscId}','${c._key}',${!!c.liked},${c.likes||0})">
                <svg width="12" height="12" fill="${c.liked ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/></svg>
                ${c.likes || 0}
              </button>
              <button class="cmt-act cmt-del" onclick="deleteComment('${currentDiscId}','${c._key}')">
                <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                Delete
              </button>
            </div>
          </div>
        </div>`)
      .join("")
    : `<p class="empty-comments">No comments yet. Be the first to respond!</p>`;

  document.getElementById("discussionBody").innerHTML = `
    <div class="disc-view-eyebrow">THE FLOOR · DISCUSSION</div>
    <div class="disc-view-title">${esc(d.title)}</div>
    <div class="disc-view-meta">
      <span class="author-chip">
        <span class="author-av" style="background:${avColour(d.author||"")};width:24px;height:24px;font-size:9px">${esc(d.authorInitials||"?")}</span>
        <strong>${esc(d.author||"")}</strong>
      </span>
      <span>·</span>
      <span>${rel(d.postedAt)}</span>
      <span>·</span>
      <span>${commentEntries.length} comment${commentEntries.length !== 1 ? "s" : ""}</span>
    </div>
    ${tags.length ? `<div class="disc-view-tags">${tags.map(t => `<span class="tag-pill">${esc(t)}</span>`).join("")}</div>` : ""}
    <div class="disc-view-divider"></div>
    ${d.image ? `<img src="${esc(d.image)}" class="disc-view-image" alt="">` : ""}
    <div class="disc-view-body">${esc(d.body)}</div>

    <div class="disc-reaction-bar">
      <button class="react-btn ${d.liked ? "liked" : ""}" onclick="reactDisc('${currentDiscId}','like')">
        <svg width="15" height="15" fill="${d.liked ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>
        ${d.likes || 0} likes
      </button>
      <button class="react-btn ${d.disliked ? "disliked" : ""}" onclick="reactDisc('${currentDiscId}','dislike')">
        <svg width="15" height="15" fill="${d.disliked ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"/></svg>
        ${d.dislikes || 0} dislikes
      </button>
    </div>

    <div class="comments-area">
      <div class="comments-title">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        ${commentEntries.length} Comment${commentEntries.length !== 1 ? "s" : ""}
      </div>
      ${commentsHtml}
      <div class="new-comment-box" style="margin-top:16px">
        <textarea class="new-comment-input" id="cmtInput" placeholder="Join the discussion..."></textarea>
        <button class="btn-post-cmt" onclick="window.postComment()">Post</button>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────
//  RENDER — POLLS (FIXED)
// ─────────────────────────────────────────────

function renderPolls() {
  const list = document.getElementById("pollsList");
  if (!list) return;

  const items = Object.entries(polls)
    .map(([key, val]) => ({ ...val, _key: key }))
    .sort((a, b) => b.postedAt - a.postedAt);

  if (!items.length) {
    list.innerHTML = `<div class="empty-state"><p class="empty-text">No polls yet. Create one!</p></div>`;
    return;
  }

  list.innerHTML = items.map(p => {
    const options = Array.isArray(p.options) ? p.options : [];
    const totalVotes = options.reduce((a, o) => a + (o.votes || 0), 0);
    
    // FIX: Check localStorage to see if this user has voted
    const localVotedIndex = localStorage.getItem(`voted_${p._key}`);
    const hasVoted = localVotedIndex !== null;
    const userVoteIndex = hasVoted ? parseInt(localVotedIndex) : null;

    const optionsHtml = options.map((o, i) => {
      const pct = totalVotes ? Math.round((o.votes || 0) / totalVotes * 100) : 0;
      const isVotedFor = userVoteIndex === i; 
      
      return `
        <div class="poll-option ${isVotedFor ? "voted-for" : ""}"
          onclick="window.votePoll('${p._key}',${i})"
          style="${hasVoted ? "cursor:default" : ""}">
          <div class="poll-bar ${isVotedFor ? "voted-bar" : ""}" style="width:${hasVoted ? pct : 0}%"></div>
          <div class="poll-option-content">
            <div class="poll-option-label">
              ${isVotedFor ? `<svg class="poll-check" width="16" height="16" fill="none" stroke="#c9a84c" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>` : ""}
              ${esc(o.label)}
            </div>
            ${hasVoted ? `<span class="poll-pct ${isVotedFor ? "gold" : ""}">${pct}%</span>` : ""}
          </div>
        </div>`;
    }).join("");

    return `
      <div class="poll-card">
        <div class="poll-title">
          <svg width="16" height="16" fill="none" stroke="#c9a84c" stroke-width="2" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          ${esc(p.question)}
        </div>
        <div class="poll-options">${optionsHtml}</div>
        <div class="poll-footer">
          <span>${totalVotes} vote${totalVotes !== 1 ? "s" : ""}</span>
          <span>·</span>
          <span>${rel(p.postedAt)}</span>
        </div>
      </div>`;
  }).join("");
}

// ─────────────────────────────────────────────
//  ACTIONS (REACTIONS / COMMENTS)
// ─────────────────────────────────────────────

async function reactDisc(key, type) {
  const d = discussions[key]; if (!d) return;
  let { likes = 0, dislikes = 0, liked = false, disliked = false } = d;

  if (type === "like") {
    if (liked) { liked = false; likes--; }
    else { liked = true; likes++; if (disliked) { disliked = false; dislikes--; } }
  } else {
    if (disliked) { disliked = false; dislikes--; }
    else { disliked = true; dislikes++; if (liked) { liked = false; likes--; } }
  }

  await update(ref(db, `discussions/${key}`), { likes, dislikes, liked, disliked });
}

async function postComment() {
  const inp = document.getElementById("cmtInput");
  if (!inp || !inp.value.trim()) return;

  const cmtRef = push(ref(db, `discussions/${currentDiscId}/comments`));
  await set(cmtRef, {
    author:   CURRENT_USER.name,
    initials: CURRENT_USER.initials,
    text:     inp.value.trim(),
    postedAt: Date.now(),
    likes:    0,
    liked:    false
  });
  inp.value = "";
}

async function likeComment(discKey, cmtKey, currentlyLiked, currentLikes) {
  const newLiked = !currentlyLiked;
  await update(ref(db, `discussions/${discKey}/comments/${cmtKey}`), {
    liked: newLiked,
    likes: newLiked ? currentLikes + 1 : currentLikes - 1
  });
}

async function deleteComment(discKey, cmtKey) {
  await remove(ref(db, `discussions/${discKey}/comments/${cmtKey}`));
}

// ─────────────────────────────────────────────
//  PUBLISH DISCUSSION
// ─────────────────────────────────────────────

function previewFile(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    attachedImageData = e.target.result;
    document.getElementById("attachPreview").textContent = "📎 " + file.name;
  };
  reader.readAsDataURL(file);
}

async function publishDiscussion() {
  const title   = document.getElementById("discTitle").value.trim();
  const body    = document.getElementById("discContent").value.trim();
  const tagsRaw = document.getElementById("discTags").value.trim();
  if (!title) { document.getElementById("discTitle").focus(); return; }

  const tags = tagsRaw ? tagsRaw.split(",").map(t => t.trim()).filter(Boolean) : [];

  const newRef = push(ref(db, "discussions"));
  await set(newRef, {
    title, body,
    author:         CURRENT_USER.name,
    authorInitials: CURRENT_USER.initials,
    tags,
    image:    attachedImageData || null,
    postedAt: Date.now(),
    likes: 0, dislikes: 0, liked: false, disliked: false
  });

  document.getElementById("discTitle").value   = "";
  document.getElementById("discContent").value = "";
  document.getElementById("discTags").value    = "";
  document.getElementById("attachPreview").textContent = "";
  document.getElementById("fileInput").value   = "";
  attachedImageData = null;
  closeModal("discussModal");
}

async function deleteDiscussion() {
  if (!currentDiscId) return;
  await remove(ref(db, `discussions/${currentDiscId}`));
  showList();
}

// ─────────────────────────────────────────────
//  POLLS (FIXED)
// ─────────────────────────────────────────────

function addPollOption() {
  const container = document.getElementById("pollOptionInputs");
  const count = container.children.length + 1;
  const row = document.createElement("div");
  row.className = "poll-opt-row";
  row.innerHTML = `<input class="form-input" type="text" placeholder="Option ${count}">
    <button class="remove-opt" onclick="window.removeOpt(this)" title="Remove">×</button>`;
  container.appendChild(row);
}

function removeOpt(btn) {
  const container = document.getElementById("pollOptionInputs");
  if (container.children.length <= 2) return;
  btn.parentElement.remove();
}

async function publishPoll() {
  const question = document.getElementById("pollQuestion").value.trim();
  if (!question) { document.getElementById("pollQuestion").focus(); return; }

  const inputs  = [...document.querySelectorAll("#pollOptionInputs .form-input")];
  const options = inputs.map(i => i.value.trim()).filter(Boolean).map(label => ({ label, votes: 0 }));
  if (options.length < 2) return;

  const newRef = push(ref(db, "polls"));
  await set(newRef, { 
    question, 
    options, 
    postedAt: Date.now() 
  });

  document.getElementById("pollQuestion").value = "";
  document.querySelectorAll("#pollOptionInputs .form-input").forEach(i => i.value = "");
  closeModal("pollModal");
  switchTab("polls");
}

async function votePoll(pollKey, optIndex) {
  const p = polls[pollKey];
  
  // 1. Check localStorage to see if user has already voted
  const hasVoted = localStorage.getItem(`voted_${pollKey}`);
  
  // If they already voted or the poll doesn't exist, stop here
  if (!p || hasVoted !== null) return;

  // 2. Prepare the updated options array by incrementing the specific index
  const options = [...(p.options || [])];
  options[optIndex] = { 
    ...options[optIndex], 
    votes: (options[optIndex].votes || 0) + 1 
  };

  try {
    // 3. Record the vote locally FIRST for instant feedback
    localStorage.setItem(`voted_${pollKey}`, optIndex);
    
    // 4. Update Firebase
    await update(ref(db, `polls/${pollKey}`), { options });

    // 5. MANUALLY TRIGGER RENDER
    // This forces the UI to look at localStorage again and show the bars immediately
    renderPolls(); 
    
  } catch (error) {
    console.error("Vote failed:", error);
    // If the database update fails, remove the local restriction so they can try again
    localStorage.removeItem(`voted_${pollKey}`);
  }
}

// ─────────────────────────────────────────────
//  UI HELPERS
// ─────────────────────────────────────────────

function switchTab(tab) {
  document.getElementById("tabDiscussions").classList.toggle("active", tab === "discussions");
  document.getElementById("tabPolls").classList.toggle("active", tab === "polls");
  document.getElementById("panelDiscussions").style.display = tab === "discussions" ? "" : "none";
  document.getElementById("panelPolls").style.display       = tab === "polls"        ? "" : "none";
  document.getElementById("filterBar").style.display        = tab === "discussions"  ? "" : "none";
}

function filterByTag(btn, tag) {
  activeTag = tag;
  document.querySelectorAll(".filter-tag").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  renderDiscussions();
}

function openModal(id)  { document.getElementById(id).classList.add("open"); }
function closeModal(id) { document.getElementById(id).classList.remove("open"); }

document.querySelectorAll(".modal-overlay").forEach(o =>
  o.addEventListener("click", e => { if (e.target === o) o.classList.remove("open"); })
);

async function checkDeepLink() {
  const params = new URLSearchParams(window.location.search);
  const postId = params.get('post');

  if (postId) {
    // Wait a brief moment for the onValue listener to populate the 'discussions' object
    setTimeout(() => {
      if (discussions[postId]) {
        window.showDiscussion(postId);
      }
    }, 600); 
  }
}



// ─────────────────────────────────────────────
//  EXPOSE TO HTML
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
//  EXPOSE TO HTML
// ─────────────────────────────────────────────

Object.assign(window, {
  showList, showDiscussion,
  openModal, closeModal,
  switchTab, filterByTag,
  reactDisc,
  postComment, likeComment, deleteComment,
  deleteDiscussion,
  previewFile, publishDiscussion,
  addPollOption, removeOpt, publishPoll, votePoll,
  renderList: renderDiscussions,
  checkDeepLink, // <--- Add this line
});

// ─────────────────────────────────────────────
//  INITIALIZATION
// ─────────────────────────────────────────────

// Run this at the very bottom of the file to check for deep links on load
checkDeepLink();
