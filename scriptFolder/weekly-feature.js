// 1. ── IMPORTS & FIREBASE SETUP ──
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, push, set, onValue, remove, update, get } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { firebaseConfig } from './app.js';

const app  = initializeApp(firebaseConfig);
const db   = getDatabase(app);
const auth = getAuth(app);

// 2. ── AUTH STATE ──
let currentUser  = null;
let userRole     = "public";
let userProfile  = null;

onAuthStateChanged(auth, async (user) => {
  // Grab the container, not just the button
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
    userRole    = "public";
    userProfile = null;
  }

  // Toggle the entire container based on the admin role
  if (adminControls) {
    adminControls.style.display = (userRole === 'admin') ? 'block' : 'none';
  }

  if (currentFeatureId) renderArticle();
  else renderList();
});

// 3. ── GLOBAL STATE ──
let features         = [];
let currentFeatureId = null;

function getDisplayName(user) {
  if (userProfile && userProfile.displayName) return userProfile.displayName;
  return user.email.split('@')[0];
}

// 4. ── HELPERS ──
function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function relativeTime(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)    return 'just now';
  if (s < 3600)  return Math.floor(s/60) + ' min ago';
  if (s < 86400) return Math.floor(s/3600) + ' hours ago';
  return Math.floor(s/86400) + ' days ago';
}
function wordCount(text) { return text.trim() ? text.trim().split(/\s+/).length : 0; }

// Per-user like helpers — reads from userLikes/{uid} map on the post
function myLiked(f)    { return !!(currentUser && f.userLikes    && f.userLikes[currentUser.uid]); }
function myDisliked(f) { return !!(currentUser && f.userDislikes && f.userDislikes[currentUser.uid]); }

// 5. ── WINDOW BINDINGS ──
window.updateWordCount     = () => { document.getElementById('wordCount').textContent     = wordCount(document.getElementById('pubContent').value) + ' words'; };
window.updateEditWordCount = () => { document.getElementById('editWordCount').textContent = wordCount(document.getElementById('editContent').value) + ' words'; };
window.openModal  = (id) => { document.getElementById(id).classList.add('open'); };
window.closeModal = (id) => { document.getElementById(id).classList.remove('open'); };
document.querySelectorAll('.modal-overlay').forEach(o => o.addEventListener('click', e => { if(e.target===o) o.classList.remove('open'); }));

window.showList = () => {
  document.getElementById('viewList').classList.add('active');
  document.getElementById('viewArticle').classList.remove('active');
  currentFeatureId = null;
  renderList();
};
window.showArticle = (id) => {
  currentFeatureId = id;
  document.getElementById('viewList').classList.remove('active');
  document.getElementById('viewArticle').classList.add('active');
  renderArticle();
};
window.openConfirmDelete = () => { window.openModal('confirmModal'); };

// 6. ── FIREBASE LISTENER ──
onValue(ref(db, 'features'), (snapshot) => {
  const data = snapshot.val();
  if (data) {
    features = Object.keys(data).map(key => {
      const f = data[key];
      const commentsArray  = f.comments  ? Object.keys(f.comments).map(cId => ({id: cId, ...f.comments[cId]})) : [];
      const reactionsArray = f.reactions ? (Array.isArray(f.reactions) ? f.reactions : Object.values(f.reactions)) : [];
      return { id: key, ...f, comments: commentsArray, reactions: reactionsArray };
    });
    features.sort((a,b) => b.postedAt - a.postedAt);
  } else { features = []; }
  if (currentFeatureId) renderArticle(); else renderList();
});

// 7. ── RENDER FUNCTIONS ──
function renderList() {
  const el = document.getElementById('featuresList'); if (!el) return;
  if (!features.length) { el.innerHTML = `<div class="empty-state"><p class="empty-text">No features published yet. Be the first to contribute!</p></div>`; return; }
  el.innerHTML = features.map(f => {
    const iLiked    = myLiked(f);
    const iDisliked = myDisliked(f);
    const excerpt   = f.content.split('\n\n')[0].slice(0,200) + (f.content.length>200?'…':'');
    return `
    <div class="feature-card" onclick="showArticle('${f.id}')">
      <div class="fc-title">${escHtml(f.title)}</div>
      <div class="fc-excerpt">${escHtml(excerpt)}</div>
      <div class="fc-meta">
        <span class="author-chip"><span class="author-av">${escHtml(f.authorInitials||'?')}</span>${escHtml(f.author)}</span>
        <span>·</span><span>${relativeTime(f.postedAt)}</span><span>·</span>
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        ${f.comments.length}
      </div>
      ${f.tag?`<div class="fc-tags"><span class="tag-pill">${escHtml(f.tag)}</span></div>`:''}
      <div class="fc-actions" onclick="event.stopPropagation()">
        <button class="react-btn ${iLiked?'liked':''}" onclick="reactFeature('${f.id}','like')">
          <svg width="14" height="14" fill="${iLiked?'currentColor':'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>
          ${f.likes||0}
        </button>
        <button class="react-btn ${iDisliked?'disliked':''}" onclick="reactFeature('${f.id}','dislike')">
          <svg width="14" height="14" fill="${iDisliked?'currentColor':'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"/></svg>
          ${f.dislikes||0}
        </button>
        <span class="see-reactions" onclick="openReactions('${f.id}')">See reactions</span>
      </div>
    </div>`;
  }).join('');
}

function renderArticle() {
  const f = features.find(x => x.id === currentFeatureId); if (!f) return window.showList();
  const paragraphs = f.content.split(/\n\n+/).map(p=>`<p>${escHtml(p.trim())}</p>`).join('');
  const wc         = wordCount(f.content);
  const readMin    = Math.max(1, Math.round(wc/200));
  const iLiked     = myLiked(f);
  const iDisliked  = myDisliked(f);

  // Only author or admin sees Edit/Delete
  const canModify  = currentUser && (f.authorId === currentUser.uid || userRole === 'admin');
  const topActions = document.getElementById('articleTopActions');
  if (topActions) {
    topActions.innerHTML = canModify ? `
      <button class="topbar-btn btn-edit" onclick="openEditModal()">
        <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Edit
      </button>
      <button class="topbar-btn btn-delete" onclick="openConfirmDelete()">
        <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>Delete
      </button>` : '';
  }

  const commentsHtml = f.comments.length
    ? f.comments.map(c => {
        const canDeleteComment = currentUser && (c.authorId === currentUser.uid || userRole === 'admin');
        return `
        <div class="comment-item" id="comment-${c.id}">
          <div class="comment-av">${escHtml(c.initials||'?')}</div>
          <div class="comment-bubble">
            <div class="comment-bubble-header">
              <span class="comment-author-name">${escHtml(c.author)}</span>
              <span class="comment-time">${relativeTime(c.postedAt)}</span>
            </div>
            <div class="comment-bubble-text">${escHtml(c.text)}</div>
            <div class="comment-bubble-actions">
              <button class="comment-action ${c.liked?'liked':''}" onclick="likeComment('${f.id}','${c.id}')">
                <svg width="12" height="12" fill="${c.liked?'currentColor':'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/></svg>
                ${c.likes||0}
              </button>
              ${canDeleteComment?`
              <button class="comment-action delete-comment" onclick="deleteComment('${f.id}','${c.id}')">
                <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>Delete
              </button>`:''}
            </div>
          </div>
        </div>`;
      }).join('')
    : '<p style="font-style:italic;color:#9ca3af;font-size:15px;">No comments yet. Be the first to respond!</p>';

  document.getElementById('articleBody').innerHTML = `
    <div class="article-eyebrow">WEEKLY FEATURE · ${f.tag?f.tag.toUpperCase():'ECONOMICS'}</div>
    <div class="article-title">${escHtml(f.title)}</div>
    <div class="article-meta">
      <span class="author-chip" style="display:flex;align-items:center;gap:6px">
        <span class="author-av">${escHtml(f.authorInitials||'?')}</span>
        <strong>${escHtml(f.author)}</strong>
      </span>
      <span>·</span><span>${relativeTime(f.postedAt)}</span><span>·</span>
      <span>${wc} words · ${readMin} min read</span>
    </div>
    ${f.tag?`<div class="article-tags"><span class="tag-pill">${escHtml(f.tag)}</span></div>`:''}
    <div class="article-divider"></div>
    <div class="article-content">${paragraphs}</div>
    <div class="reaction-bar">
      <button class="react-btn ${iLiked?'liked':''}" onclick="reactFeature('${f.id}','like')">
        <svg width="15" height="15" fill="${iLiked?'currentColor':'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>
        ${f.likes||0} likes
      </button>
      <button class="react-btn ${iDisliked?'disliked':''}" onclick="reactFeature('${f.id}','dislike')">
        <svg width="15" height="15" fill="${iDisliked?'currentColor':'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"/></svg>
        ${f.dislikes||0} dislikes
      </button>
      <span class="reaction-count">${f.reactions.length} reaction${f.reactions.length!==1?'s':''} &nbsp;·&nbsp; <span style="color:var(--gold);cursor:pointer" onclick="openReactions('${f.id}')">See all</span></span>
    </div>
    <div class="comments-area">
      <div class="comments-title">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        ${f.comments.length} Comment${f.comments.length!==1?'s':''}
      </div>
      <div id="commentItems">${commentsHtml}</div>
      <div class="new-comment-box" style="margin-top:20px">
        <textarea class="new-comment-input" id="newCommentInput" placeholder="Share your thoughts on this essay..."></textarea>
        <div class="new-comment-right">
          <button class="btn-post-comment" onclick="postComment('${f.id}')">Post Comment</button>
        </div>
      </div>
    </div>`;
}

// 8. ── DATABASE MUTATIONS ──
window.publishFeature = async () => {
  if (!currentUser) return alert("Please log in to post.");

  // 1. Fetch user role from database before allowing the post
  try {
    const userRef = ref(db, `users/${currentUser.uid}`);
    const userSnapshot = await get(userRef);
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

  // 2. Proceed with validation
  const title   = document.getElementById('pubTitle').value.trim();
  const content = document.getElementById('pubContent').value.trim();
  const tag     = document.getElementById('pubTag').value.trim();

  if (!title)   { document.getElementById('pubTitle').focus();   return; }
  if (!content) { document.getElementById('pubContent').focus(); return; }

  // 3. Perform the mutation
  const name = getDisplayName(currentUser);
  set(push(ref(db, 'features')), {
    title, content, tag,
    author: name, 
    authorInitials: name.substring(0,2).toUpperCase(), 
    authorId: currentUser.uid,
    postedAt: Date.now(), 
    likes: 0, 
    dislikes: 0
  }).then(() => {
    // 4. Cleanup UI
    document.getElementById('pubTitle').value = '';
    document.getElementById('pubContent').value = '';
    document.getElementById('pubTag').value = '';
    document.getElementById('wordCount').textContent = '0 words';
    window.closeModal('publishModal');
  }).catch((error) => {
    alert("Publish failed: " + error.message);
  });
};

window.reactFeature = (id, type) => {
  if (!currentUser) return alert("Please log in to react.");
  const f   = features.find(x => x.id === id); if (!f) return;
  const uid = currentUser.uid;
  const wasLiked    = !!(f.userLikes    && f.userLikes[uid]);
  const wasDisliked = !!(f.userDislikes && f.userDislikes[uid]);
  let likes    = f.likes    || 0;
  let dislikes = f.dislikes || 0;
  const updates = {};

  if (type === 'like') {
    if (wasLiked) { updates[`features/${id}/userLikes/${uid}`] = null; likes--; }
    else {
      updates[`features/${id}/userLikes/${uid}`] = true; likes++;
      if (wasDisliked) { updates[`features/${id}/userDislikes/${uid}`] = null; dislikes--; }
    }
  } else {
    if (wasDisliked) { updates[`features/${id}/userDislikes/${uid}`] = null; dislikes--; }
    else {
      updates[`features/${id}/userDislikes/${uid}`] = true; dislikes++;
      if (wasLiked) { updates[`features/${id}/userLikes/${uid}`] = null; likes--; }
    }
  }
  updates[`features/${id}/likes`]    = likes;
  updates[`features/${id}/dislikes`] = dislikes;

  // Update reactions list (for "See reactions" modal), keyed by uid
  const userName     = getDisplayName(currentUser);
  const userInitials = userName.substring(0,2).toUpperCase();
  const newType = type === 'like' ? '👍' : '👎';
  const alreadyToggled = (type==='like'&&wasLiked)||(type==='dislike'&&wasDisliked);
  if (alreadyToggled) {
    updates[`features/${id}/reactionsByUser/${uid}`] = null;
  } else {
    updates[`features/${id}/reactionsByUser/${uid}`] = { uid, name: userName, initials: userInitials, type: newType };
  }
  update(ref(db), updates);
};

window.openReactions = (id) => {
  const f = features.find(x => x.id === id); if (!f) return;
  const reactionMap = f.reactionsByUser || {};
  const list = Object.values(reactionMap);
  const html = list.length
    ? list.map(r=>`<div class="reaction-row"><div class="avatar-sm">${escHtml(r.initials)}</div>${escHtml(r.name)}<span class="reaction-type">${r.type}</span></div>`).join('')
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
    author: name, initials: name.substring(0,2).toUpperCase(),
    authorId: currentUser.uid, text: input.value.trim(),
    postedAt: Date.now(), likes: 0, liked: false
  });
  input.value = '';
};

window.likeComment = (featureId, commentId) => {
  const f = features.find(x=>x.id===featureId); if(!f) return;
  const c = f.comments.find(x=>x.id===commentId); if(!c) return;
  const newLiked = !c.liked;
  update(ref(db,`features/${featureId}/comments/${commentId}`),{liked:newLiked,likes:(c.likes||0)+(newLiked?1:-1)});
};

window.deleteComment = (featureId, commentId) => {
  if (confirm("Delete this comment?")) remove(ref(db,`features/${featureId}/comments/${commentId}`));
};

window.openEditModal = () => {
  const f = features.find(x=>x.id===currentFeatureId); if(!f) return;
  document.getElementById('editTitle').value   = f.title;
  document.getElementById('editTag').value     = f.tag||'';
  document.getElementById('editContent').value = f.content;
  document.getElementById('editWordCount').textContent = wordCount(f.content)+' words';
  window.openModal('editModal');
};

window.saveEdit = () => {
  const f = features.find(x=>x.id===currentFeatureId); if(!f) return;
  update(ref(db,`features/${currentFeatureId}`),{
    title:   document.getElementById('editTitle').value.trim()||f.title,
    tag:     document.getElementById('editTag').value.trim(),
    content: document.getElementById('editContent').value.trim()||f.content
  }).then(()=>window.closeModal('editModal'));
};

window.deleteFeature = () => {
  if (currentFeatureId) {
    remove(ref(db,`features/${currentFeatureId}`)).then(()=>{window.closeModal('confirmModal');window.showList();});
  }
};
