// 1. ── IMPORTS & FIREBASE SETUP ──
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, push, set, onValue, remove, update, get } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { firebaseConfig } from './config.js';
import { profileAvatarHtml } from "./profile-link.js";
import { softDelete } from './deletePost.js';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-storage.js";
import { validateImageFile, validateDocFile } from './upload-validation.js';
import { preserveInputs } from './preserve-inputs.js';

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
const storage = getStorage(app); // Initialize Storage



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

// Add 'image' to the toolbar array
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
  ['link', 'image'], // ADDED IMAGE HERE
  ['clean']
];

// Inline Image Handler for Firebase Storage
function quillImageHandler() {
  const input = document.createElement('input');
  input.setAttribute('type', 'file');
  input.setAttribute('accept', 'image/*');
  input.click();

  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    const invalid = validateImageFile(file);
    if (invalid) { alert(invalid); return; }

    // Get the editor instance that triggered this
    const editor = this.quill;
    const range = editor.getSelection(true);

    try {
      const imgRef = storageRef(storage, `inline_images/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`);
      const snapshot = await uploadBytes(imgRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      editor.insertEmbed(range.index, 'image', downloadURL);
      editor.setSelection(range.index + 1);
    } catch (error) {
      console.error("Image upload failed:", error);
      alert("Failed to upload image. Please try again.");
    }
  };
}

const wQuill = new Quill('#wEditor', {
  theme: 'snow',
  modules: {
    toolbar: {
      container: QUILL_TOOLBAR,
      handlers: { image: quillImageHandler }
    }
  },
  placeholder: 'Write your essay here…'
});

const eQuill = new Quill('#eEditor', {
  theme: 'snow',
  modules: {
    toolbar: {
      container: QUILL_TOOLBAR,
      handlers: { image: quillImageHandler }
    }
  },
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
  // Sign-in can finish before the posts load. Rendering a missing item fell back
  // to the list and dropped the link, so leave that case to the data listener.
  if (currentPostId) { if (posts.some(x => x.id === currentPostId)) renderArticle(); } else renderList();
});


// 3. ── GLOBAL STATE ──
let posts = [];
// An essay can be opened by link (perspectives.html?essay=<id>) or handed over
// via sessionStorage (Bulletin, profile activity).
let currentPostId = new URLSearchParams(window.location.search).get("essay")
  || sessionStorage.getItem("openPerspective") || null;

// Keeps the address bar in step with the open essay so Back returns to the list.
function syncEssayUrl(id, mode) {
  if (mode === 'none') return;
  const params = new URLSearchParams(window.location.search);
  if ((params.get('essay') || null) === (id || null)) return;
  const url = id ? `${window.location.pathname}?essay=${encodeURIComponent(id)}` : window.location.pathname;
  history[mode === 'replace' ? 'replaceState' : 'pushState'](id ? { essay: id } : {}, '', url);
}

window.addEventListener('popstate', () => {
  const id = new URLSearchParams(window.location.search).get('essay');
  if (id && posts.find(p => p.id === id)) window.showArticle(id, { history: 'none' });
  else window.showList({ history: 'none' });
});
let activeTag = 'all';
let sortMode = 'newest';
let pendingImgData = null;
let pendingDocData = null;
let pendingDocName = null;
let editImgData = null;
let editDocData = null;
let editDocName = null;
let coverFileRemoved = false;
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
  const n = s < 86400 ? Math.floor(s / 3600) : Math.floor(s / 86400);
  return `${n} ${s < 86400 ? 'hour' : 'day'}${n === 1 ? '' : 's'} ago`;
}

// Counts come from the per-user maps when present: the stored counters drift
// when two people react at the same moment.
function likeCount(p) { return p.userLikes ? Object.keys(p.userLikes).length : (p.likes || 0); }
function dislikeCount(p) { return p.userDislikes ? Object.keys(p.userDislikes).length : (p.dislikes || 0); }

function myLiked(p) { return !!(currentUser && p.userLikes && p.userLikes[currentUser.uid]); }
function myDisliked(p) { return !!(currentUser && p.userDislikes && p.userDislikes[currentUser.uid]); }

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


// 4. ── WINDOW BINDINGS ──
window.openModal = async (id) => {
  if (id === 'writeModal') {
    if (!auth.currentUser && typeof auth.authStateReady === 'function') await auth.authStateReady();
    if (!auth.currentUser) {
      if (confirm('You need to sign in to write an essay. Go to the sign-in page?')) window.location.href = 'auth.html';
      return;
    }
  }
  document.getElementById(id).classList.add('open');
};
window.closeModal = (id) => { document.getElementById(id).classList.remove('open'); };
window.renderList = renderList;
document.querySelectorAll('.modal-overlay').forEach(o =>
  o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); })
);

let writeCoverFile = null;     // single File, or null
let editCoverFile = null;      // single File, existing url string, or null
let editCoverRemoved = false;  // true if the user removed the existing cover during edit
let writeDocs = [];
let editDocs = [];
let removedExistingDocs = [];   // Track removed docs from existing posts

window.handleCoverFile = (input, type) => {
  const file = input.files[0];
  if (!file) return;

  const error = validateImageFile(file);
  if (error) { alert(error); input.value = ''; return; }

  if (type === 'w') {
    writeCoverFile = file;
  } else {
    editCoverFile = file;
    editCoverRemoved = false;
  }

  input.value = '';
  window.renderCoverPreview(type);
};

window.renderCoverPreview = (type) => {
  const containerId = type === 'w' ? 'wImgPreviewContainer' : 'eImgPreviewContainer';
  const container = document.getElementById(containerId);
  const coverValue = type === 'w' ? writeCoverFile : editCoverFile;

  container.innerHTML = '';

  if (!coverValue) {
    container.style.display = 'none';
    return;
  }

  const src = coverValue instanceof File ? URL.createObjectURL(coverValue) : coverValue;
  container.style.display = 'block';

  const wrap = document.createElement('div');
  wrap.style.cssText = "position:relative; width:160px; max-width:100%;";
  wrap.innerHTML = `
    <img src="${src}" style="width:100%; display:block; border-radius:8px; border:1px solid #f0d5b0;" alt="Cover preview">
    <button type="button" onclick="window.removeCoverImage('${type}')"
      style="position:absolute; top:-8px; right:-8px; background:#ff4d4d; color:white; border:none; border-radius:50%; width:20px; height:20px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:12px; padding:0;">✕</button>
  `;
  container.appendChild(wrap);
};

window.removeCoverImage = (type) => {
  if (type === 'w') {
    writeCoverFile = null;
  } else {
    editCoverFile = null;
    editCoverRemoved = true;
  }
  window.renderCoverPreview(type);
};

window.handleMultipleFiles = (input, type, category) => {
  const files = Array.from(input.files);
  if (!files.length) return;

  for (const file of files) {
    const error = validateDocFile(file);
    if (error) { alert(error); input.value = ''; return; }
  }

  if (type === 'w' && category === 'doc') writeDocs.push(...files);
  if (type === 'e' && category === 'doc') editDocs.push(...files);

  input.value = '';
  window.renderPreviews(type, category);
};

window.renderPreviews = (type, category) => {
  let array = [];
  let containerId = '';
  
  if (type === 'w' && category === 'doc') { array = writeDocs; containerId = 'wDocPreviewContainer'; }
  if (type === 'e' && category === 'doc') { array = editDocs; containerId = 'eDocPreviewContainer'; }
  
  const container = document.getElementById(containerId);
  container.innerHTML = ''; 
  
  if (array.length > 0) {
    container.style.display = 'flex';
    array.forEach((file, index) => {
      const pill = document.createElement('div');
      pill.style.cssText = "display: flex; align-items: center; padding: 4px 10px; background: #fff5e6; border: 1px solid #f0d5b0; border-radius: 20px; font-size: 12px; color: #b38036;";
      
      // Handle both new File objects and existing URL objects
      const fileName = file.name || file.fileName || 'Attached File';
      
      pill.innerHTML = `
        <span style="margin-right: 8px;">📎 ${esc(fileName)}</span>
        <button type="button" onclick="window.removeFile(${index}, '${type}', '${category}')" 
          style="background: #ff4d4d; color: white; border: none; border-radius: 50%; width: 16px; height: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 10px; padding: 0;">✕</button>
      `;
      container.appendChild(pill);
    });
  } else {
    container.style.display = 'none';
  }
};

window.removeFile = (index, type, category) => {
  let removedItem;
  if (type === 'w' && category === 'doc') writeDocs.splice(index, 1);
  if (type === 'e' && category === 'doc') {
    removedItem = editDocs.splice(index, 1)[0];
    if (removedItem.url) removedExistingDocs.push(removedItem);
  }
  window.renderPreviews(type, category);
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

window.showList = ({ history: historyMode = 'push' } = {}) => {
  document.getElementById('viewList').classList.add('active');
  document.getElementById('viewArticle').classList.remove('active');
  currentPostId = null;
  syncEssayUrl(null, historyMode);
  renderList();
};
window.showArticle = (id, { history: historyMode = 'push' } = {}) => {
  const switching = currentPostId !== id;
  currentPostId = id;
  syncEssayUrl(id, historyMode);
  document.getElementById('viewList').classList.remove('active');
  document.getElementById('viewArticle').classList.add('active');
  renderArticle();
  if (switching) window.scrollTo(0, 0);
};

window.filterTag = (btn, tag) => {
  activeTag = tag;
  document.querySelectorAll('.filter-tag').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderList();
};
window.sortPosts = (mode) => { sortMode = mode; renderList(); };

window.togglePin = async (id, alreadyPinned) => {
  try {
    await togglePinWrite(id, alreadyPinned);
    if (alreadyPinned) pinnedIds.delete(id); else pinnedIds.add(id);
  } catch (err) {
    console.error('Pin/unpin failed:', err);
    alert('Could not update the Bulletin. Please try again.');
  }
  renderArticle();
};

async function togglePinWrite(id, alreadyPinned) {
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
}

// The Bulletin keeps its own copy of a pinned essay's title and text: update
// it on edit (fields) or remove it on delete (null).
async function syncPinnedCopy(id, fields) {
  try {
    const snap = await get(ref(db, 'bulletin'));
    const entries = Object.entries(snap.val() || {}).filter(([, v]) => v.originalId === id && v.type === 'perspective');
    await Promise.all(entries.map(([key]) => fields ? update(ref(db, `bulletin/${key}`), fields) : remove(ref(db, `bulletin/${key}`))));
  } catch (err) {
    console.warn('Could not update the Bulletin copy of this essay:', err);
  }
}


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
    syncEssayUrl(currentPostId, 'replace');
    renderArticle();
  } else {
    syncEssayUrl(null, 'replace');
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
      String(p.title || '').toLowerCase().includes(q) ||
      String(p.author || '').toLowerCase().includes(q) ||
      (p.tags && p.tags.some(t => t.toLowerCase().includes(q)));
    return matchTag && matchSearch;
  });

  if (sortMode === 'oldest') filtered.sort((a, b) => a.postedAt - b.postedAt);
  else if (sortMode === 'popular') filtered.sort((a, b) => likeCount(b) - likeCount(a));
  else filtered.sort((a, b) => b.postedAt - a.postedAt);

  const el = document.getElementById('postsList');
  if (!el) return;

  if (!filtered.length) {
    // Distinguish "no essays exist at all" from "your search/filter matched
    // none of them" — showing the same "be the first to write one!" message
    // for a filter with zero matches was misleading when essays do exist.
    el.innerHTML = posts.length
      ? `<div class="empty-state"><div class="empty-italic">No perspectives match your search or filter.</div><div class="empty-sub">Try a different topic or search term.</div></div>`
      : `<div class="empty-state"><div class="empty-italic">Share your perspective.</div><div class="empty-sub">Write about any topic related to economics — even abstractly.</div></div>`;
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
<div class="persp-card ${cardTheme}" role="link" tabindex="0" onclick="showArticle('${p.id}')">
  <div class="section-label"><svg width="11" height="11" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 11H6a4 4 0 014-4V5a6 6 0 00-6 6v7h6v-7zm10 0h-4a4 4 0 014-4V5a6 6 0 00-6 6v7h6v-7z"/></svg>PERSPECTIVES</div>
  <div class="pc-header">
    <div class="pc-title-group">
      <div class="pc-title" style="${isPinned ? 'color:var(--accent-text)' : ''}">${esc(p.title)}</div>
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
      <span>${likeCount(p)}</span>
    </button>
    <button class="react-btn ${iDisliked ? 'disliked' : ''}" onclick="react('${p.id}','dislike')" title="Dislike">
      <svg width="14" height="14" fill="${iDisliked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"/></svg>
      <span>${dislikeCount(p)}</span>
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
    ? DOMPurify.sanitize(p.contentHtml || '')
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
    : '<p style="font-style:italic;color:var(--text-muted);font-size:15px">No comments yet. Share your thoughts!</p>';

  const fontStyle = p.richText ? '' : `font-family:${getFontStack(p.fontFamily)}`;

  document.getElementById('articleBody').className = `article-body article-container ${mainTheme}`;
  const articleBodyEl = document.getElementById('articleBody');
  preserveInputs(articleBodyEl, () => { articleBodyEl.innerHTML = `
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
    ${p.image ? `<img src="${esc(p.image)}" class="article-img" alt="">` : ''}
    ${(p.documents && p.documents.length) ? `<div class="article-docs" style="margin:20px 0; display:flex; flex-direction:column; gap:8px;">
      ${p.documents.map(doc => `<a href="${esc(doc.url)}" download="${esc(doc.name || 'attachment')}" target="_blank" rel="noopener" style="display:inline-flex; align-items:center; gap:8px; padding:10px 15px; background:var(--bg-card); border:1px solid var(--border); border-radius:5px; color:var(--text-main); text-decoration:none; font-weight:bold; width:fit-content;">📥 ${esc(doc.name || 'File')}</a>`).join('')}
    </div>` : ''}
    ${p.documentData ? `<div class="article-doc" style="margin:20px 0;"><a href="${esc(p.documentData)}" download="${esc(p.documentName || 'attachment')}" style="padding:10px 15px; background:var(--bg-card); border:1px solid var(--border); border-radius:5px; color:var(--text-main); text-decoration:none; font-weight:bold;">📥 Download ${esc(p.documentName || 'File')}</a></div>` : ''}
    <div class="article-content" style="${fontStyle}">${articleHtml}</div>
    <div class="reaction-bar">
      <button class="react-btn ${iLiked ? 'liked' : ''}" onclick="react('${p.id}','like')">
        <svg width="15" height="15" fill="${iLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>
        ${likeCount(p)} like${likeCount(p) === 1 ? '' : 's'}
      </button>
      <button class="react-btn ${iDisliked ? 'disliked' : ''}" onclick="react('${p.id}','dislike')">
        <svg width="15" height="15" fill="${iDisliked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"/></svg>
        ${dislikeCount(p)} dislike${dislikeCount(p) === 1 ? '' : 's'}
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
    </div>`; });
}


// 7. ── DATABASE MUTATIONS ──
// Uploads can take seconds; a second click used to publish a duplicate.
let essaySaving = false;
async function runSaving(buttonSelector, busyLabel, task) {
  if (essaySaving) return;
  const btn = document.querySelector(buttonSelector);
  const label = btn ? btn.innerHTML : '';
  essaySaving = true;
  if (btn) { btn.disabled = true; btn.textContent = busyLabel; }
  try { await task(); }
  finally {
    essaySaving = false;
    if (btn) { btn.disabled = false; btn.innerHTML = label; }
  }
}

window.publishPost = () => runSaving('#writeModal .btn-full', 'Publishing…', publishPostTask);

async function publishPostTask() {
  if (!auth.currentUser) return alert("Please sign in to publish an essay.");
  const title = document.getElementById('wTitle').value.trim();
  const subtitle = document.getElementById('wSubtitle') ? document.getElementById('wSubtitle').value.trim() : '';
  const tags = document.getElementById('wTags').value ? [document.getElementById('wTags').value] : [];
  const contentHtml = wQuill.root.innerHTML;
  const contentText = wQuill.getText();
  
  if (!title) return alert("Title required.");
  if (!contentText.trim()) return alert("Content required.");

  try {
    let coverUrl = '';
    if (writeCoverFile) {
      const fileRef = storageRef(storage, `post_covers/${Date.now()}_${writeCoverFile.name}`);
      await uploadBytes(fileRef, writeCoverFile);
      coverUrl = await getDownloadURL(fileRef);
    }

    const uploadedDocs = [];
    for (const file of writeDocs) {
      const fileRef = storageRef(storage, `post_docs/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      uploadedDocs.push({ name: file.name, url });
    }

    const displayName = getDisplayName();

    const newPostData = {
      title,
      subtitle,
      tags,
      contentHtml,
      contentText,
      richText: true,
      image: coverUrl,
      documents: uploadedDocs,
      author: displayName,
      authorId: auth.currentUser.uid,
      authorInitials: displayName.substring(0, 2).toUpperCase(),
      authorRole: userRole,
      postedAt: Date.now(),
      likes: 0,
      dislikes: 0
    };

    await push(ref(db, 'perspectives'), newPostData);
    
    // Reset Modal
    wQuill.setContents([]);
    document.getElementById('wTitle').value = '';
    if (document.getElementById('wSubtitle')) document.getElementById('wSubtitle').value = '';
    document.getElementById('wTags').value = '';
    writeCoverFile = null;
    writeDocs = [];
    window.renderCoverPreview('w');
    window.renderPreviews('w', 'doc');
    window.closeModal('writeModal');

  } catch (error) {
    console.error("Error publishing post:", error);
    alert("Failed to publish post. Please try again.");
  }
}


window.react = (id, type) => {
  if (!currentUser) return alert("Please log in to react.");
  const p = posts.find(x => x.id === id); if (!p) return;

  const uid = currentUser.uid;
  const wasLiked = !!(p.userLikes && p.userLikes[uid]);
  const wasDisliked = !!(p.userDislikes && p.userDislikes[uid]);
  let likes = likeCount(p);
  let dislikes = dislikeCount(p);

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


let commentSaving = false;
window.postComment = async (postId) => {
  if (!currentUser) return alert("Please log in to comment.");
  const inp = document.getElementById('cmtInput');
  if (!inp || !inp.value.trim() || commentSaving) return;
  const name = getDisplayName();
  const text = inp.value.trim();
  // Cleared before the write (which re-renders, keeping typed text); restored on failure.
  inp.value = '';
  commentSaving = true;
  try {
    await set(push(ref(db, `perspectives/${postId}/comments`)), {
      author: name,
      initials: name.substring(0, 2).toUpperCase(),
      authorId: currentUser.uid,
      authorRole: userRole,
      text,
      postedAt: Date.now(),
      likes: 0,
      liked: false
    });
  } catch (err) {
    console.error('Post comment failed:', err);
    const box = document.getElementById('cmtInput');
    if (box && !box.value) box.value = text;
    alert('Your comment could not be posted. Please try again.');
  } finally {
    commentSaving = false;
  }
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


window.deleteComment = async (postId, cmtId) => {
  if (!confirm("Delete this comment?")) return;
  try {
    await remove(ref(db, `perspectives/${postId}/comments/${cmtId}`));
  } catch (err) {
    console.error('Delete comment failed:', err);
    alert('This comment could not be deleted. Please try again.');
  }
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
    
  // Load the existing cover image and documents into edit state
  editCoverFile = p.image || null;
  editCoverRemoved = false;
  editDocs = p.documents ? [...p.documents] : [];
  removedExistingDocs = [];

  // Render the previews inside the edit modal
  window.renderCoverPreview('e');
  window.renderPreviews('e', 'doc');

  window.openModal('editModal');
};


window.saveEdit = () => runSaving('#editModal .btn-full', 'Saving…', saveEditTask);

async function saveEditTask() {
  const p = posts.find(x => x.id === currentPostId); if (!p) return;
  
  const title = document.getElementById('eTitle').value.trim();
  const subtitle = document.getElementById('eSubtitle') ? document.getElementById('eSubtitle').value.trim() : '';
  const tags = document.getElementById('eTags').value ? [document.getElementById('eTags').value] : [];
  const contentHtml = eQuill.root.innerHTML;
  const contentText = eQuill.getText();
  
  if (!title) return alert("Title required.");
  if (!contentText.trim()) return alert("Content required.");

  try {
    // Process the cover image: upload a new file, keep the existing URL, or clear it if removed
    let coverUrl = '';
    if (editCoverFile instanceof File) {
      const fileRef = storageRef(storage, `post_covers/${Date.now()}_${editCoverFile.name}`);
      await uploadBytes(fileRef, editCoverFile);
      coverUrl = await getDownloadURL(fileRef);
    } else if (editCoverRemoved) {
      coverUrl = '';
    } else if (typeof editCoverFile === 'string') {
      coverUrl = editCoverFile; // unchanged existing cover
    }

    // Process edit documents: upload new ones, keep existing ones
    const finalDocs = [];
    for (const item of editDocs) {
      if (item instanceof File) {
        const fileRef = storageRef(storage, `post_docs/${Date.now()}_${item.name}`);
        await uploadBytes(fileRef, item);
        const url = await getDownloadURL(fileRef);
        finalDocs.push({ name: item.name, url });
      } else {
        finalDocs.push(item);
      }
    }

    const updatedData = {
      title,
      subtitle,
      tags,
      contentHtml,
      contentText,
      richText: true,
      image: coverUrl,
      documents: finalDocs
    };

    const id = currentPostId;
    await update(ref(db, `perspectives/${id}`), updatedData);
    await syncPinnedCopy(id, { title, subtitle, body: contentText, tags });

    // Clean up attachments the user removed during this edit. Best-effort:
    // the DB is already the source of truth and no longer references these,
    // so a failed delete here just leaves an orphaned file, not a broken post.
    for (const removed of removedExistingDocs) {
      try {
        await deleteObject(storageRef(storage, removed.url));
      } catch (cleanupError) {
        console.warn("Failed to delete removed attachment from storage:", removed.url, cleanupError);
      }
    }

    // Clear state and close modal
    editCoverFile = null;
    editCoverRemoved = false;
    editDocs = [];
    removedExistingDocs = [];
    window.closeModal('editModal');

  } catch (error) {
    console.error("Error updating post:", error);
    alert("Failed to update post. Please try again.");
  }
}


window.deletePost = async () => {
  if (!currentPostId) return;
  const id = currentPostId;
  try {
    // Unpin first, or the Bulletin keeps a card that leads nowhere.
    await syncPinnedCopy(id, null);
    await softDelete('perspectives', id);
    window.closeModal('confirmModal');
    window.showList({ history: 'replace' });
  } catch (err) {
    console.error('Delete essay failed:', err);
    alert('This essay could not be deleted. Please try again.');
  }
};