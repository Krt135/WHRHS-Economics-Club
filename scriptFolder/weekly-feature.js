// 1. ── IMPORTS & FIREBASE SETUP ──
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, push, set, onValue, remove, update, get } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { firebaseConfig } from './config.js';
import { profileAvatarHtml } from "./profile-link.js";
import { softDelete } from './deletePost.js';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-storage.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const storage = getStorage(app);

async function uploadFileToStorage(file, folderPath) {
  if (!file) return null;
  const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
  const sRef = storageRef(storage, `${folderPath}/${fileName}`);
  await uploadBytes(sRef, file);
  return await getDownloadURL(sRef);
}

const LEGACY_FONT_STACKS = {
  'Arial': 'Arial, sans-serif',
  'Times New Roman': '"Times New Roman", serif',
  'Georgia': 'Georgia, serif',
  'Courier New': '"Courier New", monospace',
  'Verdana': 'Verdana, sans-serif',
  'Trebuchet MS': '"Trebuchet MS", sans-serif',
  'Palatino': '"Palatino Linotype", Palatino, serif',
  'Garamond': 'Garamond, serif',
};
function getFontStack(name) {
  return LEGACY_FONT_STACKS[name] || LEGACY_FONT_STACKS['Georgia'];
}

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

const pubQuill = new Quill('#pubEditor', {
  theme: 'snow',
  modules: { toolbar: QUILL_TOOLBAR },
  placeholder: 'Write your essay here…'
});

const editQuill = new Quill('#editEditor', {
  theme: 'snow',
  modules: { toolbar: QUILL_TOOLBAR },
  placeholder: 'Edit your essay here…'
});

pubQuill.on('text-change', () => {
  document.getElementById('wordCount').textContent =
    wordCount(pubQuill.getText()) + ' words';
});
editQuill.on('text-change', () => {
  document.getElementById('editWordCount').textContent =
    wordCount(editQuill.getText()) + ' words';
});

// 2. ── AUTH STATE ──
let currentUser = null;
let userRole = "public";
let userProfile = null;

onAuthStateChanged(auth, async (user) => {
  const adminControls = document.getElementById('admin-only-controls');

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

  if (adminControls) {
    adminControls.style.display = (userRole === 'admin') ? 'block' : 'none';
  }

  if (currentFeatureId) renderArticle();
  else renderList();
});

// 3. ── GLOBAL STATE ──
let features = [];
let currentFeatureId = sessionStorage.getItem("openFeature") || null;

const urlParams = new URLSearchParams(window.location.search);
const articleSlug = urlParams.get("article");
let activeTag = 'all';
let pinnedIds = new Set();

function getDisplayName(user) {
  if (userProfile && userProfile.displayName) return userProfile.displayName;
  return user.email.split('@')[0];
}

// 4. ── HELPERS ──
function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function applyInlineFormatting(s) {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<em>$1</em>')
    .replace(/\*(.+?)\*/g, '<span style="font-weight:bold">$1</span>')
    .replace(/~(.+?)~/g, '<u>$1</u>');
}

function parseContent(raw) {
  return (raw || "").split(/\n\n+/).map(para => {
    para = para.trim();
    if (para.startsWith("===")) {
      const h = para.replace(/^===\s*/, "").replace(/\s*===$/, "");
      return `<h3>${applyInlineFormatting(escHtml(h))}</h3>`;
    }
    if (para.startsWith("[EXAMPLE]")) {
      const inner = para.replace("[EXAMPLE]", "").replace("[/EXAMPLE]", "").trim();
      return `<div class="example-box"><strong>EXAMPLE</strong>${applyInlineFormatting(escHtml(inner))}</div>`;
    }
    return `<p>${applyInlineFormatting(escHtml(para))}</p>`;
  }).join("");
}

function relativeTime(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + ' hours ago';
  return Math.floor(s / 86400) + ' days ago';
}

function wordCount(text) { return text.trim() ? text.trim().split(/\s+/).length : 0; }

function myLiked(f) { return !!(currentUser && f.userLikes && f.userLikes[currentUser.uid]); }
function myDisliked(f) { return !!(currentUser && f.userDislikes && f.userDislikes[currentUser.uid]); }

// 5. ── WINDOW BINDINGS ──
window.openModal = (id) => { document.getElementById(id).classList.add('open'); };
window.closeModal = (id) => { document.getElementById(id).classList.remove('open'); };
window.renderList = renderList;

document.querySelectorAll('.modal-overlay').forEach(o =>
  o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); })
);

window.showList = () => {
  document.getElementById('viewList').classList.add('active');
  document.getElementById('viewArticle').classList.remove('active');
  currentFeatureId = null;
  renderList();
};

window.showArticle = (id) => {
  currentFeatureId = id;

  const feature = features.find(f => f.id === id);
  if (feature) {
    const slug = feature.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    history.pushState({ article: id }, '', `weekly-feature.html?article=${slug}`);
  }

  document.getElementById('viewList').classList.remove('active');
  document.getElementById('viewArticle').classList.add('active');
  renderArticle();
};

window.openConfirmDelete = () => { window.openModal('confirmModal'); };

window.togglePin = async (id, alreadyPinned) => {
  if (alreadyPinned) {
    const snap = await get(ref(db, "bulletin"));
    const data = snap.val() || {};
    const entry = Object.entries(data).find(([, v]) => v.originalId === id && v.type === 'weekly');
    if (entry) await remove(ref(db, `bulletin/${entry[0]}`));
  } else {
    const f = features.find(x => x.id === id);
    if (!f) return;

    const commentCount = f.comments ? f.comments.length : 0;
    const name = getDisplayName(currentUser);
    const bodyText = f.richText ? (f.contentText || '') : (f.content || '');

    await set(push(ref(db, "bulletin")), {
      originalId: id,
      type: 'weekly',
      title: f.title,
      subtitle: f.subtitle || '',
      body: bodyText,
      author: f.author,
      authorId: f.authorId || null,
      authorInitials: f.authorInitials || "?",
      tags: f.tag ? [f.tag] : [],
      postedAt: f.postedAt,
      commentCount,
      pinnedAt: Date.now(),
      pinnedBy: name
    });
  }
  renderArticle();
};

// 6. ── FIREBASE LISTENER ──
onValue(ref(db, 'features'), (snapshot) => {
  const data = snapshot.val();
  if (data) {
    features = Object.keys(data).map(key => {
      const f = data[key];
      const commentsArray = f.comments ? Object.keys(f.comments).map(cId => ({ id: cId, ...f.comments[cId] })) : [];
      const reactionsArray = f.reactions ? (Array.isArray(f.reactions) ? f.reactions : Object.values(f.reactions)) : [];
      return { id: key, ...f, comments: commentsArray, reactions: reactionsArray };
    });
    features.sort((a, b) => b.postedAt - a.postedAt);

    if (articleSlug && !currentFeatureId) {
      const matchingArticle = features.find(f => {
        const slug = f.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
        return slug === articleSlug;
      });
      if (matchingArticle) currentFeatureId = matchingArticle.id;
    }

    if (currentFeatureId) {
      const postExists = features.find(f => f.id === currentFeatureId);
      if (postExists) {
        sessionStorage.removeItem("openFeature");
      } else {
        currentFeatureId = null;
      }
    }
  } else {
    features = [];
  }

  if (currentFeatureId) {
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

// 7. ── RENDER FUNCTIONS ──
function renderList() {
  const el = document.getElementById('featuresList');
  if (!el) return;

  if (!features || features.length === 0) {
    el.innerHTML = `<div class="empty-state"><p class="empty-text">No features published yet. Be the first to contribute!</p></div>`;
    return;
  }

  const searchInput = document.getElementById('searchInput');
  const q = searchInput ? searchInput.value.toLowerCase() : '';

  let displayFeatures = features.filter(f => {
    const matchTag = !activeTag || activeTag === 'all' || f.tag === activeTag;
    const matchSearch = !q ||
      (f.title && f.title.toLowerCase().includes(q)) ||
      (f.author && f.author.toLowerCase().includes(q)) ||
      (f.tag && f.tag.toLowerCase().includes(q));
    return matchTag && matchSearch;
  });

  if (displayFeatures.length === 0) {
    el.innerHTML = `<div class="empty-state"><p class="empty-text">No features found matching your search or tag criteria.</p></div>`;
    return;
  }

  el.innerHTML = displayFeatures.map(f => {
    const iLiked = myLiked(f);
    const iDisliked = myDisliked(f);

    const rawText = f.richText ? (f.contentText || '') : (f.content || '');
    const excerpt = rawText.slice(0, 200) + (rawText.length > 200 ? '…' : '');
    const isPinned = pinnedIds.has(f.id);

    return `
    <div class="feature-card" onclick="showArticle('${f.id}')">
      ${isPinned ? `
      <div class="pinned-badge">
        <svg width="11" height="11" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
        Pinned to Bulletin
      </div>` : ''}
      <div class="fc-title" style="${isPinned ? 'color:var(--gold)' : ''}">${escHtml(f.title)}</div>
      ${f.subtitle ? `<div class="fc-subtitle" style="font-style: italic; color: var(--text-muted, #8e8e93); font-size: 0.95rem; margin-top: 6px; margin-bottom: 8px;">${escHtml(f.subtitle)}</div>` : ''}
      <div class="fc-excerpt">${escHtml(excerpt)}</div>
      <div class="fc-meta">
        <span class="author-chip">
          ${profileAvatarHtml(f.authorId, "span", "author-av", "", escHtml(f.authorInitials || "?"), { role: f.authorRole || "member" })}
          ${escHtml(f.author)}
        </span>
        <span>·</span><span>${relativeTime(f.postedAt)}</span><span>·</span>
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
        </svg>
        ${f.comments ? f.comments.length : 0}
      </div>
      ${f.tag ? `<div class="fc-tags"><span class="tag-pill">${escHtml(f.tag)}</span></div>` : ''}
      <div class="fc-actions" onclick="event.stopPropagation()">
        <button class="react-btn ${iLiked ? 'liked' : ''}" onclick="reactFeature('${f.id}','like')">
          <svg width="14" height="14" fill="${iLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/>
            <path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/>
          </svg>
          ${f.likes || 0}
        </button>
        <button class="react-btn ${iDisliked ? 'disliked' : ''}" onclick="reactFeature('${f.id}','dislike')">
          <svg width="14" height="14" fill="${iDisliked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"/>
            <path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"/>
          </svg>
          ${f.dislikes || 0}
        </button>
        <span class="see-reactions" onclick="openReactions('${f.id}')">See reactions</span>
      </div>
    </div>`;
  }).join('');
}

function renderArticle() {
  const f = features.find(x => x.id === currentFeatureId);
  if (!f) return window.showList();

  const articleHtml = f.richText
    ? (f.contentHtml || '')
    : parseContent(f.content);

  const rawText = f.richText ? (f.contentText || '') : (f.content || '');
  const wc = wordCount(rawText);
  const readMin = Math.max(1, Math.round(wc / 200));

  const iLiked = myLiked(f);
  const iDisliked = myDisliked(f);

  const canEdit = currentUser && f.authorId === currentUser.uid;
  const canDelete = currentUser && (f.authorId === currentUser.uid || userRole === 'admin');
  const isAdmin = userRole === 'admin';

  // Fixed specific variable scopes referencing the 'f' object rather than 'l'
  const imgHtml = f.imageUrl ? `<img src="${f.imageUrl}" style="max-width:100%; border-radius:8px; margin: 16px 0;">` : '';
  const fileHtml = f.fileUrl ? `<div style="margin: 16px 0; padding: 12px; background: #f3f4f6; border-radius: 6px;"><a href="${f.fileUrl}" target="_blank" style="font-weight:bold; color:var(--primary); text-decoration:none;">📎 Download Attached File: ${f.fileName || 'Attachment'}</a></div>` : '';

  const topActions = document.getElementById('articleTopActions');
  if (topActions) {
    get(ref(db, "bulletin")).then(snap => {
      const bulletinData = snap.val() || {};
      const alreadyPinned = Object.values(bulletinData).some(b => b.originalId === f.id && b.type === 'weekly');

      topActions.innerHTML = `
        ${canEdit ? `
          <button class="topbar-btn btn-edit" onclick="openEditModal()">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>Edit
          </button>` : ''}
        ${canDelete ? `
          <button class="topbar-btn btn-delete" onclick="openConfirmDelete()">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
            </svg>Delete
          </button>` : ''}
        ${isAdmin ? `
          <button class="topbar-btn btn-pin-tb ${alreadyPinned ? 'pinned' : ''}"
                  onclick="window.togglePin('${f.id}', ${alreadyPinned})">
            <svg width="13" height="13" fill="${alreadyPinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            ${alreadyPinned ? 'Unpin' : 'Pin to Bulletin'}
          </button>` : ''}`;
    });
  }

  const commentsHtml = f.comments.length
    ? f.comments.map(c => {
      const totalCommentLikes = c.userLikes ? Object.keys(c.userLikes).length : 0;
      const amILiked = currentUser && c.userLikes && c.userLikes[currentUser.uid];
      const canDeleteComment = currentUser && (c.authorId === currentUser.uid || userRole === 'admin');

      return `
        <div class="comment-item" id="comment-${c.id}">
          ${profileAvatarHtml(c.authorId, "span", "author-av", "", escHtml(c.initials || "?"), { role: c.authorRole || "member" })}
          <div class="comment-bubble">
            <div class="comment-bubble-header">
              <span class="comment-author-name">${escHtml(c.author)}</span>
              <span class="comment-time">${relativeTime(c.postedAt)}</span>
            </div>
            <div class="comment-bubble-text">${escHtml(c.text)}</div>
            <div class="comment-bubble-actions">
              <button class="comment-action ${amILiked ? 'liked' : ''}" onclick="likeComment('${f.id}','${c.id}')">
                <svg width="12" height="12" fill="${amILiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/>
                </svg>
                ${totalCommentLikes}
              </button>
              ${canDeleteComment ? `
              <button class="comment-action delete-comment" onclick="deleteComment('${f.id}','${c.id}')">
                <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                </svg>Delete
              </button>` : ''}
            </div>
          </div>
        </div>`;
    }).join('')
    : '<p style="font-style:italic;color:#9ca3af;font-size:15px;">No comments yet. Be the first to respond!</p>';

  const fontStyle = f.richText ? '' : `font-family:${getFontStack(f.fontFamily)}`;

  document.getElementById('articleBody').innerHTML = `
    <div class="article-eyebrow">WEEKLY FEATURE · ${f.tag ? f.tag.toUpperCase() : 'ECONOMICS'}</div>
    <div class="article-title">${escHtml(f.title)}</div>
    <div class="article-meta">
      <span class="author-chip" style="display:flex;align-items:center;gap:6px">
        ${profileAvatarHtml(f.authorId, "span", "author-av", "", escHtml(f.authorInitials || "?"), { role: f.authorRole || "member" })}
        <strong>${escHtml(f.author)}</strong>
      </span>
      <span>·</span><span>${relativeTime(f.postedAt)}</span><span>·</span>
      <span>${wc} words · ${readMin} min read</span>
    </div>
    ${f.tag ? `<div class="article-tags"><span class="tag-pill">${escHtml(f.tag)}</span></div>` : ''}
    <div class="article-divider"></div>
    ${imgHtml}
    ${fileHtml}
    <div class="article-content" style="${fontStyle}">${articleHtml}</div>
    <div class="reaction-bar">
      <button class="react-btn ${iLiked ? 'liked' : ''}" onclick="reactFeature('${f.id}','like')">
        <svg width="15" height="15" fill="${iLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/>
          <path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/>
        </svg>
        ${f.likes || 0} likes
      </button>
      <button class="react-btn ${iDisliked ? 'disliked' : ''}" onclick="reactFeature('${f.id}','dislike')">
        <svg width="15" height="15" fill="${iDisliked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"/>
          <path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"/>
        </svg>
        ${f.dislikes || 0} dislikes
      </button>
      <span class="reaction-count">
        ${f.reactions.length} reaction${f.reactions.length !== 1 ? 's' : ''}
        &nbsp;·&nbsp;
        <span style="color:var(--gold);cursor:pointer" onclick="openReactions('${f.id}')">See all</span>
      </span>
    </div>
    <div class="comments-area">
      <div class="comments-title">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
        </svg>
        ${f.comments.length} Comment${f.comments.length !== 1 ? 's' : ''}
      </div>
      <div id="commentItems">${commentsHtml}</div>
      <div class="new-comment-box" style="margin-top:20px">
        <textarea class="new-comment-input" id="newCommentInput"
          placeholder="Share your thoughts on this essay..."></textarea>
        <div class="new-comment-right">
          <button class="btn-post-comment" onclick="postComment('${f.id}')">Post Comment</button>
        </div>
      </div>
    </div>`;
}

// 8. ── DATABASE MUTATIONS ──
window.publishFeature = async () => {
  if (!currentUser) return alert("Please log in to post.");

  try {
    const userSnapshot = await get(ref(db, `users/${currentUser.uid}`));
    const userData = userSnapshot.val();
    if (!userData || userData.role !== 'admin') {
      alert("Access Denied: Only Exec Board members can publish Weekly Features.");
      window.closeModal('publishModal');
      return;
    }
  } catch (error) {
    console.error("Error verifying permissions:", error);
    return alert("System error. Please try again later.");
  }

  const title = document.getElementById('pubTitle').value.trim();
  const subtitle = document.getElementById('pubSubtitle').value.trim();
  const tag = document.getElementById('pubTag').value.trim();
  const contentHtml = pubQuill.root.innerHTML;
  const contentText = pubQuill.getText().trim();
  const imgFile = document.getElementById("cImage").files[0];
  const attFile = document.getElementById("cFile").files[0];

  const imageUrl = await uploadFileToStorage(imgFile, 'weekly_images');
  const fileUrl = await uploadFileToStorage(attFile, 'weekly_files');
  const fileName = attFile ? attFile.name : null;

  

  if (!title) { document.getElementById('pubTitle').focus(); return; }
  if (!contentText) { pubQuill.focus(); return; }

  const name = getDisplayName(currentUser);

  set(push(ref(db, 'features')), {
    title, subtitle, tag,
    richText: true,
    contentHtml,
    contentText,
    imageUrl,
    fileUrl,
    fileName,
    author: name,
    authorInitials: name.substring(0, 2).toUpperCase(),
    authorId: currentUser.uid,
    authorRole: userRole,
    postedAt: Date.now(),
    likes: 0,
    dislikes: 0
  }).then(() => {
    document.getElementById('pubTitle').value = '';
    document.getElementById('pubSubtitle').value = '';
    document.getElementById('pubTag').value = '';
    document.getElementById('cImage').value = '';
    document.getElementById('cFile').value = '';
    pubQuill.setContents([]);
    document.getElementById('wordCount').textContent = '0 words';
    window.closeModal('publishModal');
  }).catch(error => {
    alert("Publish failed: " + error.message);
  });
};

window.reactFeature = (id, type) => {
  if (!currentUser) return alert("Please log in to react.");
  const f = features.find(x => x.id === id);
  if (!f) return;

  const uid = currentUser.uid;
  const wasLiked = !!(f.userLikes && f.userLikes[uid]);
  const wasDisliked = !!(f.userDislikes && f.userDislikes[uid]);
  let likes = f.likes || 0;
  let dislikes = f.dislikes || 0;

  const postRef = ref(db, `features/${id}`);
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

  const userName = getDisplayName(currentUser);
  const userInitials = userName.substring(0, 2).toUpperCase();
  const newType = type === 'like' ? '👍' : '👎';
  const alreadyToggled = (type === 'like' && wasLiked) || (type === 'dislike' && wasDisliked);

  updates[`reactionsByUser/${uid}`] = alreadyToggled
    ? null
    : { uid, name: userName, initials: userInitials, type: newType };

  update(postRef, updates).catch(err => console.error("Reaction error:", err));
};

window.openReactions = (id) => {
  const f = features.find(x => x.id === id); if (!f) return;
  const list = Object.values(f.reactionsByUser || {});
  const html = list.length
    ? list.map(r => `
        <div class="reaction-row">
          ${profileAvatarHtml(r.uid, "div", "avatar-sm", "", escHtml(r.initials), { role: r.role || "member" })}
          ${escHtml(r.name)}<span class="reaction-type">${r.type}</span>
        </div>`).join("")
    : '<p style="color:#9ca3af;font-size:14px;padding:12px 0">No reactions yet.</p>';
  document.getElementById('reactionsList').innerHTML = html;
  window.openModal('reactionsModal');
};

window.postComment = (featureId) => {
  if (!currentUser) return alert("Please log in to comment.");
  const input = document.getElementById('newCommentInput');
  if (!input || !input.value.trim()) return;
  const name = getDisplayName(currentUser);
  set(push(ref(db, `features/${featureId}/comments`)), {
    author: name,
    initials: name.substring(0, 2).toUpperCase(),
    authorId: currentUser.uid,
    authorRole: userRole,
    text: input.value.trim(),
    postedAt: Date.now(),
    likes: 0,
    liked: false
  });
  input.value = '';
};

window.likeComment = async (featureId, commentId) => {
  if (!auth.currentUser) { alert("Please log in to like comments."); return; }
  const uid = auth.currentUser.uid;
  const f = features.find(x => x.id === featureId); if (!f) return;
  const c = f.comments.find(x => x.id === commentId); if (!c) return;
  const hasLiked = c.userLikes && c.userLikes[uid];
  const likeRef = ref(db, `features/${featureId}/comments/${commentId}/userLikes/${uid}`);
  if (hasLiked) { await remove(likeRef); } else { await set(likeRef, true); }
};

window.deleteComment = (featureId, commentId) => {
  if (confirm("Delete this comment?"))
    remove(ref(db, `features/${featureId}/comments/${commentId}`));
};

window.openEditModal = () => {
  const f = features.find(x => x.id === currentFeatureId); if (!f) return;

  document.getElementById('editTitle').value = f.title;
  document.getElementById('editSubtitle').value = f.subtitle || '';
  document.getElementById('editTag').value = f.tag || '';

  document.getElementById('eImage').value = '';
  document.getElementById('eFile').value = '';
  document.getElementById('eImageStatus').innerHTML = f.imageUrl ? `Current: <a href="${f.imageUrl}" target="_blank">View Image</a>` : 'None';
  document.getElementById('eFileStatus').innerHTML = f.fileUrl ? `Current: <a href="${f.fileUrl}" target="_blank">${f.fileName || 'View File'}</a>` : 'None';

  if (f.richText) {
    editQuill.clipboard.dangerouslyPasteHTML(f.contentHtml || '');
  } else {
    editQuill.setText(f.content || '');
  }

  const rawText = f.richText ? (f.contentText || '') : (f.content || '');
  document.getElementById('editWordCount').textContent = wordCount(rawText) + ' words';
  window.openModal('editModal');
};

window.saveEdit = async () => {
  const f = features.find(x => x.id === currentFeatureId); if (!f) return;

  const contentHtml = editQuill.root.innerHTML;
  const contentText = editQuill.getText().trim();
  const imgFile = document.getElementById("eImage").files[0];
  const attFile = document.getElementById("eFile").files[0];

  if (!contentText) { editQuill.focus(); return; }

  const updates = {
    title: document.getElementById('editTitle').value.trim() || f.title,
    subtitle: document.getElementById('editSubtitle').value.trim(),
    tag: document.getElementById('editTag').value.trim(),
    richText: true,
    contentHtml,
    contentText
  };

  if (imgFile) updates.imageUrl = await uploadFileToStorage(imgFile, 'weekly_images');
  if (attFile) {
    updates.fileUrl = await uploadFileToStorage(attFile, 'weekly_files');
    updates.fileName = attFile.name;
  }

  update(ref(db, `features/${currentFeatureId}`), updates).then(() => window.closeModal('editModal'));
};

window.deleteFeature = async () => {
  if (currentFeatureId) {
    await softDelete('features', currentFeatureId);
    window.closeModal('confirmModal');
    window.showList();
  }
};

window.filterByTag = (btn, tag) => {
  activeTag = tag;
  document.querySelectorAll(".filter-tag").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  renderList();
};