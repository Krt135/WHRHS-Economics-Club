// 1. ── IMPORTS & FIREBASE SETUP ──
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, push, set, onValue, remove, update, get } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { firebaseConfig } from './config.js';
import { profileAvatarHtml } from "./profile-link.js";
import { softDelete } from './deletePost.js';

const LEGACY_FONT_STACKS = {
  'Arial': 'Arial, sans-serif',
  'Times New Roman': '\"Times New Roman\", serif',
  'Georgia': 'Georgia, serif',
  'Courier New': '\"Courier New\", monospace',
  'Verdana': 'Verdana, sans-serif',
  'Trebuchet MS': '\"Trebuchet MS\", sans-serif',
  'Palatino': '\"Palatino Linotype\", Palatino, serif',
  'Garamond': 'Garamond, serif',
};
function getFontStack(name) {
  return LEGACY_FONT_STACKS[name] || LEGACY_FONT_STACKS['Georgia'];
}

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);


// ── QUILL SETUP ──
const Font = Quill.import('formats/font');
Font.whitelist = [
  'arial', 'times-new-roman', 'georgia',
  'courier-new', 'verdana', 'trebuchet-ms', 'palatino', 'garamond'
];
Quill.register(Font, true);

const QuillSize = Quill.import('attributors/style/size');
QuillSize.whitelist = ['10px', '12px', '14px', '18px', '24px', '32px'];
Quill.register(QuillSize, true);

const QUILL_TOOLBAR = [
  ['bold', 'italic', 'underline'],
  [{
    font: [
      false,
      'arial', 'times-new-roman', 'georgia',
      'courier-new', 'verdana', 'trebuchet-ms', 'palatino', 'garamond'
    ]
  }],
  [{ size: ['10px', '12px', '14px', false, '18px', '24px', '32px'] }],
  ['link'],
  ['clean']
];

const wQuill = new Quill('#wEditor', {
  theme: 'snow',
  modules: { toolbar: QUILL_TOOLBAR },
  placeholder: 'Write your essay here…'
});

const eQuill = new Quill('#eEditor', {
  theme: 'snow',
  modules: { toolbar: QUILL_TOOLBAR },
  placeholder: 'Edit your essay here…'
});

wQuill.on('text-change', () => {
  const text = wQuill.getText();
  document.getElementById('wWC').textContent =
    (text.trim() ? text.trim().split(/\s+/).length : 0) + ' words';
});
eQuill.on('text-change', () => {
  const text = eQuill.getText();
  document.getElementById('eWC').textContent =
    (text.trim() ? text.trim().split(/\s+/).length : 0) + ' words';
});


// 2. ── AUTH STATE ──
let currentUser = null;
let userRole = "public";
let userProfile = null;

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
  if (currentPostId) renderArticle(); else renderList();
});


// 3. ── GLOBAL STATE ──
let posts = [];
let currentPostId = sessionStorage.getItem("openPerspective") || null;
let activeTag = 'all';
let sortMode = 'newest';
let pendingImgData = null;
let pendingDocData = null;
let pendingDocName = null;
let editImgData = null;
let editDocData = null;
let editDocName = null;
let pinnedIds = new Set();

function getDisplayName() {
  if (userProfile && userProfile.displayName) return userProfile.displayName;
  if (currentUser && currentUser.email) return currentUser.email.split("@")[0];
  return "Member";
}

function rel(ts) {
  if (!ts) return "just now";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + " min ago";
  if (s < 86400) return Math.floor(s / 3600) + " hours ago";
  return Math.floor(s / 86400) + " days ago";
}

function myLiked(p) { return !!(currentUser && p.userLikes && p.userLikes[currentUser.uid]); }
function myDisliked(p) { return !!(currentUser && p.userDislikes && p.userDislikes[currentUser.uid]); }

function esc(s) {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


// 4. ── WINDOW BINDINGS ──
window.openModal = (id) => { document.getElementById(id).classList.add('open'); };
window.closeModal = (id) => { document.getElementById(id).classList.remove('open'); };
window.renderList = renderList;
document.querySelectorAll('.modal-overlay').forEach(o =>
  o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); })
);

window.previewImg = (input, previewId, dataKey) => {
  const file = input.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = e => {
    if (dataKey === 'wImgData') pendingImgData = e.target.result;
    else editImgData = e.target.result;
    document.getElementById(previewId).textContent = '📎 ' + file.name;
  };
  r.readAsDataURL(file);
};

window.previewDoc = (input, previewId, dataKey) => {
  const file = input.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = e => {
    if (dataKey === 'wDocData') {
      pendingDocData = e.target.result;
      pendingDocName = file.name;
    } else {
      editDocData = e.target.result;
      editDocName = file.name;
    }
    document.getElementById(previewId).textContent = '📎 ' + file.name;
  };
  r.readAsDataURL(file);
};

window.showList = () => {
  document.getElementById('viewList').classList.add('active');
  document.getElementById('viewArticle').classList.remove('active');
  currentPostId = null;
  renderList();
};
window.showArticle = (id) => {
  currentPostId = id;
  document.getElementById('viewList').classList.remove('active');
  document.getElementById('viewArticle').classList.add('active');
  renderArticle();
};

window.filterTag = (btn, tag) => {
  activeTag = tag;
  document.querySelectorAll('.filter-tag').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderList();
};
window.sortPosts = (mode) => { sortMode = mode; renderList(); };

window.togglePin = async (id, alreadyPinned) => {
  if (alreadyPinned) {
    const snap = await get(ref(db, "bulletin"));
    const data = snap.val() || {};
    const entry = Object.entries(data).find(([, v]) => v.originalId === id && v.type === 'perspective');
    if (entry) await remove(ref(db, `bulletin/${entry[0]}`));
  } else {
    const p = posts.find(x => x.id === id);
    if (!p) return;

    const commentCount = p.comments ? p.comments.length : 0;
    const name = getDisplayName();
    const bodyText = p.richText ? (p.contentText || '') : (p.content || '');

    await set(push(ref(db, "bulletin")), {
      originalId: id,
      type: 'perspective',
      title: p.title,
      subtitle: p.subtitle || '',
      body: bodyText,
      author: p.author,
      authorId: p.authorId || null,
      authorInitials: p.authorInitials || "?",
      authorRole: p.authorRole || userRole,
      tags: p.tags || [],
      postedAt: p.postedAt,
      commentCount,
      pinnedAt: Date.now(),
      pinnedBy: name
    });
  }
  renderArticle();
};


// 5. ── FIREBASE LISTENER ──
onValue(ref(db, 'perspectives'), (snapshot) => {
  const data = snapshot.val();

  if (data) {
    posts = Object.keys(data).map(key => {
      const post = data[key];
      const commentsArray = post.comments
        ? Object.keys(post.comments).map(cId => ({ id: cId, ...post.comments[cId] }))
        : [];
      return { id: key, ...post, comments: commentsArray, tags: post.tags || [], postedAt: post.postedAt };
    });

    if (currentPostId) {
      const postExists = posts.find(p => p.id === currentPostId);
      if (postExists) {
        sessionStorage.removeItem("openPerspective");
      } else {
        currentPostId = null;
      }
    }
  } else {
    posts = [];
  }

  if (currentPostId) {
    document.getElementById('viewList').classList.remove('active');
    document.getElementById('viewArticle').classList.add('active');
    renderArticle();
  } else {
    get(ref(db, 'bulletin')).then(snap => {
      const bData = snap.val() || {};
      pinnedIds = new Set(Object.values(bData).map(v => v.originalId).filter(Boolean));
      renderList();
    });
  }
});


// 6. ── RENDER FUNCTIONS ──
function rebuildFilterBar() {
  const bar = document.getElementById('filterBar'); if (!bar) return;
  const topics = ['Macro', 'Micro', 'Money', 'Trade', 'Markets', 'Policy'];
  bar.innerHTML = `<span class="filter-label">FILTER:</span>
    <button class="filter-tag ${activeTag === 'all' ? 'active' : ''}" onclick="filterTag(this,'all')">All</button>
    ${topics.map(t => `<button class="filter-tag ${activeTag === t ? 'active' : ''}" onclick="filterTag(this,'${t}')">${t}</button>`).join('')}`;
}

function renderList() {
  rebuildFilterBar();
  const searchInput = document.getElementById('searchInput');
  const q = searchInput ? searchInput.value.toLowerCase() : '';

  let filtered = posts.filter(p => {
    const matchTag = activeTag === 'all' || (p.tags && p.tags.includes(activeTag));
    const matchSearch = !q ||
      p.title.toLowerCase().includes(q) ||
      p.author.toLowerCase().includes(q) ||
      (p.tags && p.tags.some(t => t.toLowerCase().includes(q)));
    return matchTag && matchSearch;
  });

  if (sortMode === 'oldest') filtered.sort((a, b) => a.postedAt - b.postedAt);
  else if (sortMode === 'popular') filtered.sort((a, b) => (b.likes || 0) - (a.likes || 0));
  else filtered.sort((a, b) => b.postedAt - a.postedAt);

  const el = document.getElementById('postsList');
  if (!el) return;

  if (!filtered.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-italic">Share your perspective.</div><div class="empty-sub">Write about any topic related to economics — even abstractly.</div></div>`;
    return;
  }

  el.innerHTML = filtered.map(p => {
    const iLiked = myLiked(p);
    const iDisliked = myDisliked(p);

    const rawText = p.richText ? (p.contentText || '') : (p.content || '');
    const excerpt = rawText.slice(0, 240) + (rawText.length > 240 ? '…' : '');

    const cardTheme = (currentUser && p.authorId === currentUser.uid) ? "theme-me"
      : (p.authorRole === "admin") ? "theme-exec"
        : "theme-member";
    const isPinned = pinnedIds.has(p.id);

return `
<div class="persp-card ${cardTheme}" onclick="showArticle('${p.id}')">
  <div class="pc-header">
    <div class="pc-title-group">
      <div class="pc-title" style="${isPinned ? 'color:var(--gold)' : ''}">${esc(p.title)}</div>
      ${p.subtitle ? `<div class="pc-subtitle" style="font-style: italic; color: var(--text-muted, #8e8e93); font-size: 0.95rem; margin-top: 6px; margin-bottom: 6px;">${esc(p.subtitle)}</div>` : ''}
    </div>
    
    ${p.featured ? `<span class="featured-badge">FEATURED</span>` : ''}
    ${isPinned ? `
    <div class="pinned-badge">
      <svg width="11" height="11" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
      Pinned to Bulletin
    </div>` : ''}
  </div>
  ${p.image ? `<img src="${p.image}" class="pc-image" alt="Post Image" loading="lazy">` : ''}
  <div class="pc-excerpt">${esc(excerpt)}</div>
  <div class="pc-meta">
    <span class="author-chip">
      ${profileAvatarHtml(p.authorId, "span", "author-av", "", esc(p.authorInitials || "?"), { role: p.authorRole || "member" })}
      ${esc(p.author)}
    </span>
    <span>·</span><span>${rel(p.postedAt)}</span><span>·</span>
    <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
    ${p.comments ? p.comments.length : 0}
  </div>
  ${(p.tags && p.tags.length) ? `<div class="pc-tags">${p.tags.map(t => `<span class="tag-pill">${esc(t)}</span>`).join('')}</div>` : ''}
  <div class="pc-actions" onclick="event.stopPropagation()">
    <button class="react-btn ${iLiked ? 'liked' : ''}" onclick="react('${p.id}','like')" title="Like">
      <svg width="14" height="14" fill="${iLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>
      <span>${p.likes || 0}</span>
    </button>
    <button class="react-btn ${iDisliked ? 'disliked' : ''}" onclick="react('${p.id}','dislike')" title="Dislike">
      <svg width="14" height="14" fill="${iDisliked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"/></svg>
      <span>${p.dislikes || 0}</span>
    </button>
  </div>
</div>`;
  }).join('');
}


function applyInlineFormatting(s) {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<em>$1</em>')
    .replace(/\*(.+?)\*/g, '<strong>$1</strong>')
    .replace(/~(.+?)~/g, '<u>$1</u>');
}

function parseContent(raw) {
  return (raw || "").split(/\n\n+/).map(para => {
    para = para.trim();
    if (para.startsWith("===")) {
      const h = para.replace(/^===\s*/, "").replace(/\s*===$/, "");
      return `<h3>${applyInlineFormatting(esc(h))}</h3>`;
    }
    if (para.startsWith("[EXAMPLE]")) {
      const inner = para.replace("[EXAMPLE]", "").replace("[/EXAMPLE]", "").trim();
      return `<div class="example-box"><strong>EXAMPLE</strong>${applyInlineFormatting(esc(inner))}</div>`;
    }
    return `<p>${applyInlineFormatting(esc(para))}</p>`;
  }).join("");
}

function renderArticle() {
  const p = posts.find(x => x.id === currentPostId);
  if (!p) return window.showList();

  const articleHtml = p.richText
    ? (p.contentHtml || '')
    : parseContent(p.content);

  const rawText = p.richText ? (p.contentText || '') : (p.content || '');
  const wds = rawText.trim() ? rawText.trim().split(/\s+/).length : 0;
  const readMin = Math.max(1, Math.round(wds / 200));

  const iLiked = myLiked(p);
  const iDisliked = myDisliked(p);

  const mainTheme = (currentUser && p.authorId === currentUser.uid) ? "theme-me"
    : (p.authorRole === "admin") ? "theme-exec"
      : "theme-member";

  const canEdit = currentUser && p.authorId === currentUser.uid;
  const canDelete = currentUser && (p.authorId === currentUser.uid || userRole === 'admin');
  const isAdmin = userRole === 'admin';

  get(ref(db, "bulletin")).then(snap => {
    const bulletinData = snap.val() || {};
    const alreadyPinned = Object.values(bulletinData).some(b => b.originalId === p.id && b.type === 'perspective');

    document.getElementById('articleTopActions').innerHTML = `
      ${canEdit ? `
        <button class="topbar-btn btn-edit" onclick="openEditModal()">
          <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Edit
        </button>` : ''}
      ${canDelete ? `
        <button class="topbar-btn btn-delete" onclick="openModal('confirmModal')">
          <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>Delete
        </button>` : ''}
      ${isAdmin ? `
        <button class="topbar-btn btn-pin-tb ${alreadyPinned ? 'pinned' : ''}" onclick="window.togglePin('${p.id}', ${alreadyPinned})">
          <svg width="13" height="13" fill="${alreadyPinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
          ${alreadyPinned ? 'Unpin' : 'Pin to Bulletin'}
        </button>` : ''}`;
  });

  const commentsHtml = p.comments.length
    ? p.comments.map(c => {
      const totalCommentLikes = c.userLikes ? Object.keys(c.userLikes).length : 0;
      const amILiked = currentUser && c.userLikes && c.userLikes[currentUser.uid];
      const canDeleteComment = currentUser && (c.authorId === currentUser.uid || userRole === 'admin');
      const commentTheme = (currentUser && c.authorId === currentUser.uid) ? "theme-me" : "theme-member";

      return `
        <div class="comment-item ${commentTheme}">
          ${profileAvatarHtml(c.authorId, "span", "author-av", "", esc(c.initials || "?"), { role: c.authorRole || "member" })}
          <div class="comment-bubble">
            <div class="comment-header">
              <span class="comment-author-name">${esc(c.author)}</span>
              <span class="comment-time">${rel(c.postedAt)}</span>
            </div>
            <div class="comment-bubble-text">${esc(c.text)}</div>
            <div class="comment-bubble-actions">
              <button class="comment-action ${amILiked ? 'liked' : ''}" onclick="likeComment('${p.id}','${c.id}')">
                <svg width="12" height="12" fill="${amILiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 002 2.3H14z"/></svg>
                ${totalCommentLikes}
              </button>
              ${canDeleteComment ? `
              <button class="comment-action delete-comment" onclick="deleteComment('${p.id}','${c.id}')">
                <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 6 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>Delete
              </button>` : ''}
            </div>
          </div>
        </div>`;
    }).join('')
    : '<p style="font-style:italic;color:#9ca3af;font-size:15px">No comments yet. Share your thoughts!</p>';

  const fontStyle = p.richText ? '' : `font-family:${getFontStack(p.fontFamily)}`;

  document.getElementById('articleBody').className = `article-body article-container ${mainTheme}`;
  document.getElementById('articleBody').innerHTML = `
    <div class="article-eyebrow">PERSPECTIVES${p.tags.length ? ' · ' + p.tags[0].toUpperCase() : ''}</div>
    <div class="article-title">${esc(p.title)}</div>
    ${p.subtitle ? `<div class="article-subtitle" style="font-style: italic; color: var(--text-muted, #8e8e93); font-size: 1.1rem; margin-top: -10px; margin-bottom: 15px;">${esc(p.subtitle)}</div>` : ''}
    <div class="article-meta">
      <span class="author-chip" style="display:flex;align-items:center;gap:6px">
        ${profileAvatarHtml(p.authorId, "span", "author-av", "", esc(p.authorInitials || "?"), { role: p.authorRole || "member" })}
        <strong>${esc(p.author)}</strong>
      </span>
      <span>·</span><span>${rel(p.postedAt)}</span><span>·</span>
      <span>${wds} words · ${readMin} min read</span>
    </div>
    ${p.tags.length ? `<div class="article-tags">${p.tags.map(t => `<span class="tag-pill">${esc(t)}</span>`).join('')}</div>` : ''}
    <div class="article-divider"></div>
    ${p.image ? `<img src="${p.image}" class="article-img" alt="">` : ''}
    ${p.documentData ? `<div class="article-doc" style="margin:20px 0;"><a href="${p.documentData}" download="${p.documentName || 'attachment'}" style="padding:10px 15px; background:var(--bg-card); border:1px solid var(--border); border-radius:5px; color:var(--text-main); text-decoration:none; font-weight:bold;">📥 Download ${esc(p.documentName || 'File')}</a></div>` : ''}
    <div class="article-content" style="${fontStyle}">${articleHtml}</div>
    <div class="reaction-bar">
      <button class="react-btn ${iLiked ? 'liked' : ''}" onclick="react('${p.id}','like')">
        <svg width="15" height="15" fill="${iLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>
        ${p.likes || 0} likes
      </button>
      <button class="react-btn ${iDisliked ? 'disliked' : ''}" onclick="react('${p.id}','dislike')">
        <svg width="15" height="15" fill="${iDisliked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"/></svg>
        ${p.dislikes || 0} dislikes
      </button>
    </div>
    <div class="comments-area">
      <div class="comments-title">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        ${p.comments.length} Comment${p.comments.length !== 1 ? 's' : ''}
      </div>
      ${commentsHtml}
      <div class="new-comment-box" style="margin-top:20px">
        <textarea class="new-comment-input" id="cmtInput" placeholder="Add a comment..."></textarea>
        <button class="btn-post-comment" onclick="postComment('${p.id}')">Post</button>
      </div>
    </div>`;
}


// 7. ── DATABASE MUTATIONS ──
window.publishPost = () => {
  if (!currentUser) return alert("Please log in to post.");

  const title = document.getElementById('wTitle').value.trim();
  const subtitle = document.getElementById('wSubtitle') ? document.getElementById('wSubtitle').value.trim() : '';
  const tag = document.getElementById('wTags').value;
  const contentHtml = wQuill.root.innerHTML;
  const contentText = wQuill.getText().trim();

  if (!title) { document.getElementById('wTitle').focus(); return; }
  if (!contentText) { wQuill.focus(); return; }

  const name = getDisplayName();
  const tags = tag ? [tag] : [];

  set(push(ref(db, 'perspectives')), {
    title, subtitle, tags,
    richText: true,
    contentHtml,
    contentText,
    author: name,
    authorInitials: name.substring(0, 2).toUpperCase(),
    authorId: currentUser.uid,
    authorRole: userRole,
    image: pendingImgData || null,
    documentData: pendingDocData || null,
    documentName: pendingDocName || null,
    postedAt: Date.now(),
    likes: 0,
    dislikes: 0,
    featured: false
  });

  pendingImgData = null;
  pendingDocData = null;
  pendingDocName = null;
  document.getElementById('wDocPreview').textContent = '';
  document.getElementById('wTitle').value = '';
  if (document.getElementById('wSubtitle')) document.getElementById('wSubtitle').value = '';
  document.getElementById('wTags').value = '';
  document.getElementById('wImgPreview').textContent = '';
  wQuill.setContents([]);
  document.getElementById('wWC').textContent = '0 words';
  window.closeModal('writeModal');
};


window.react = (id, type) => {
  if (!currentUser) return alert("Please log in to react.");
  const p = posts.find(x => x.id === id); if (!p) return;

  const uid = currentUser.uid;
  const wasLiked = !!(p.userLikes && p.userLikes[uid]);
  const wasDisliked = !!(p.userDislikes && p.userDislikes[uid]);
  let likes = p.likes || 0;
  let dislikes = p.dislikes || 0;

  const postRef = ref(db, `perspectives/${id}`);
  const updates = {};

  if (type === 'like') {
    if (wasLiked) {
      updates[`userLikes/${uid}`] = null; likes--;
    } else {
      updates[`userLikes/${uid}`] = true; likes++;
      if (wasDisliked) { updates[`userDislikes/${uid}`] = null; dislikes--; }
    }
  } else {
    if (wasDisliked) {
      updates[`userDislikes/${uid}`] = null; dislikes--;
    } else {
      updates[`userDislikes/${uid}`] = true; dislikes++;
      if (wasLiked) { updates[`userLikes/${uid}`] = null; likes--; }
    }
  }

  updates['likes'] = likes;
  updates['dislikes'] = dislikes;
  update(postRef, updates).catch(err => console.error("Reaction error:", err));
};


window.postComment = (postId) => {
  if (!currentUser) return alert("Please log in to comment.");
  const inp = document.getElementById('cmtInput');
  if (!inp || !inp.value.trim()) return;
  const name = getDisplayName();
  set(push(ref(db, `perspectives/${postId}/comments`)), {
    author: name,
    initials: name.substring(0, 2).toUpperCase(),
    authorId: currentUser.uid,
    text: inp.value.trim(),
    postedAt: Date.now(),
    likes: 0,
    liked: false
  });
  inp.value = '';
};


window.likeComment = async (postId, cmtId) => {
  if (!auth.currentUser) { alert("Please log in to like comments."); return; }
  const uid = auth.currentUser.uid;
  const p = posts.find(x => x.id === postId); if (!p) return;
  const c = p.comments.find(x => x.id === cmtId); if (!c) return;
  const hasLiked = c.userLikes && c.userLikes[uid];
  const likeRef = ref(db, `perspectives/${postId}/comments/${cmtId}/userLikes/${uid}`);
  if (hasLiked) { await remove(likeRef); } else { await set(likeRef, true); }
};


window.deleteComment = (postId, cmtId) => {
  if (confirm("Delete this comment?"))
    remove(ref(db, `perspectives/${postId}/comments/${cmtId}`));
};


window.openEditModal = () => {
  const p = posts.find(x => x.id === currentPostId); if (!p) return;

  document.getElementById('eTitle').value = p.title;
  if (document.getElementById('eSubtitle')) document.getElementById('eSubtitle').value = p.subtitle || '';
  document.getElementById('eTags').value  = p.tags[0] || '';

  if (p.richText) {
    eQuill.clipboard.dangerouslyPasteHTML(p.contentHtml || '');
  } else {
    eQuill.setText(p.content || '');
  }

  const rawText = p.richText ? (p.contentText || '') : (p.content || '');
  document.getElementById('eWC').textContent =
    (rawText.trim() ? rawText.trim().split(/\s+/).length : 0) + ' words';
    
  document.getElementById('eImgPreview').textContent = p.image ? '📎 Current image attached' : '';
  editImgData = null;

  editDocData = null;
  editDocName = null;
  const eDocPreview = document.getElementById('eDocPreview');
  if (eDocPreview) {
    eDocPreview.textContent = p.documentName ? '📎 ' + p.documentName : '';
  }

  window.openModal('editModal');
};


window.saveEdit = () => {
  const p = posts.find(x => x.id === currentPostId); if (!p) return;

  const contentHtml = eQuill.root.innerHTML;
  const contentText = eQuill.getText().trim();
  if (!contentText) { eQuill.focus(); return; }

  const updatedData = {
    title:       document.getElementById('eTitle').value.trim() || p.title,
    subtitle:    document.getElementById('eSubtitle') ? document.getElementById('eSubtitle').value.trim() : (p.subtitle || ''),
    tags:        document.getElementById('eTags').value ? [document.getElementById('eTags').value] : [],
    richText:    true,
    contentHtml,
    contentText
  };
  
  if (editImgData) updatedData.image = editImgData;
  if (editDocData) {
    updatedData.documentData = editDocData;
    updatedData.documentName = editDocName;
  }

  update(ref(db, `perspectives/${currentPostId}`), updatedData)
    .then(() => window.closeModal('editModal'));
};


window.deletePost = async () => {
  if (currentPostId) {
    await softDelete('perspectives', currentPostId);
    window.closeModal('confirmModal');
    window.showList();
  }
};