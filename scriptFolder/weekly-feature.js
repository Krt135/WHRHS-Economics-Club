// 1. ── IMPORTS & FIREBASE SETUP ──
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import { getDatabase, ref, push, set, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-database.js";
import { firebaseConfig } from './app.js'; // Using your centralized config

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 2. ── GLOBAL STATE ──
let features = []; // Starts empty, filled by Firebase
let currentFeatureId = null;

// 3. ── HELPERS ──
function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function relativeTime(timestamp) {
  const s = Math.floor((Date.now() - timestamp) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s/60) + ' min ago';
  if (s < 86400) return Math.floor(s/3600) + ' hours ago';
  return Math.floor(s/86400) + ' days ago';
}

function wordCount(text) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

// 4. ── WINDOW BINDINGS (For HTML Elements) ──
window.updateWordCount = () => {
  const c = document.getElementById('pubContent').value;
  document.getElementById('wordCount').textContent = wordCount(c) + ' words';
};
window.updateEditWordCount = () => {
  const c = document.getElementById('editContent').value;
  document.getElementById('editWordCount').textContent = wordCount(c) + ' words';
};

window.openModal = (id) => { document.getElementById(id).classList.add('open'); };
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

// 5. ── FIREBASE LISTENER (The Core Engine) ──
const featuresRef = ref(db, 'features');
onValue(featuresRef, (snapshot) => {
  const data = snapshot.val();
  if (data) {
    // Convert Firebase object back into our array structure
    features = Object.keys(data).map(key => {
      const f = data[key];
      const commentsArray = f.comments ? Object.keys(f.comments).map(cId => ({id: cId, ...f.comments[cId]})) : [];
      const reactionsArray = f.reactions ? Object.values(f.reactions) : [];
      
      return {
        id: key,
        ...f,
        comments: commentsArray,
        reactions: reactionsArray
      };
    });
    
    // Sort so newest are at the top
    features.sort((a, b) => b.postedAt - a.postedAt);
  } else {
    features = [];
  }
  
  // Re-render whatever view the user is looking at
  if (currentFeatureId) renderArticle();
  else renderList();
});

// 6. ── RENDER FUNCTIONS (Private) ──
function renderList() {
  const el = document.getElementById('featuresList');
  if (!el) return; // Safety check
  if (!features.length) {
    el.innerHTML = `<div class="empty-state"><p class="empty-text">No features published yet. Be the first to contribute!</p></div>`;
    return;
  }
  el.innerHTML = features.map(f => {
    const excerpt = f.content.split('\n\n')[0].slice(0, 200) + (f.content.length > 200 ? '…' : '');
    return `
    <div class="feature-card" onclick="showArticle('${f.id}')">
      <div class="fc-title">${escHtml(f.title)}</div>
      <div class="fc-excerpt">${escHtml(excerpt)}</div>
      <div class="fc-meta">
        <span class="author-chip"><span class="author-av">${f.authorInitials}</span>${escHtml(f.author)}</span>
        <span>·</span>
        <span>${relativeTime(f.postedAt)}</span>
        <span>·</span>
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        ${f.comments.length}
      </div>
      ${f.tag ? `<div class="fc-tags"><span class="tag-pill">${escHtml(f.tag)}</span></div>` : ''}
      <div class="fc-actions" onclick="event.stopPropagation()">
        <button class="react-btn ${f.liked?'liked':''}" onclick="reactFeature('${f.id}','like')">
          <svg width="14" height="14" fill="${f.liked?'currentColor':'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>
          ${f.likes}
        </button>
        <button class="react-btn ${f.disliked?'disliked':''}" onclick="reactFeature('${f.id}','dislike')">
          <svg width="14" height="14" fill="${f.disliked?'currentColor':'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"/></svg>
          ${f.dislikes}
        </button>
        <span class="see-reactions" onclick="openReactions('${f.id}')">See reactions</span>
      </div>
    </div>`;
  }).join('');
}

function renderArticle() {
  const f = features.find(x => x.id === currentFeatureId);
  if (!f) return window.showList();

  const paragraphs = f.content.split(/\n\n+/).map(p => `<p>${escHtml(p.trim())}</p>`).join('');
  const wc = wordCount(f.content);
  const readMin = Math.max(1, Math.round(wc / 200));

  const commentsHtml = f.comments.length
    ? f.comments.map(c => `
        <div class="comment-item" id="comment-${c.id}">
          <div class="comment-av">${c.initials}</div>
          <div class="comment-bubble">
            <div class="comment-bubble-header">
              <span class="comment-author-name">${escHtml(c.author)}</span>
              <span class="comment-time">${relativeTime(c.postedAt)}</span>
            </div>
            <div class="comment-bubble-text">${escHtml(c.text)}</div>
            <div class="comment-bubble-actions">
              <button class="comment-action ${c.liked?'liked':''}" onclick="likeComment('${f.id}','${c.id}')">
                <svg width="12" height="12" fill="${c.liked?'currentColor':'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/></svg>
                ${c.likes}
              </button>
              <button class="comment-action delete-comment" onclick="deleteComment('${f.id}','${c.id}')">
                <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                Delete
              </button>
            </div>
          </div>
        </div>`).join('')
    : '<p style="font-style:italic;color:#9ca3af;font-size:15px;">No comments yet. Be the first to respond!</p>';

  document.getElementById('articleBody').innerHTML = `
    <div class="article-eyebrow">WEEKLY FEATURE · ${f.tag ? f.tag.toUpperCase() : 'ECONOMICS'}</div>
    <div class="article-title">${escHtml(f.title)}</div>
    <div class="article-meta">
      <span class="author-chip" style="display:flex;align-items:center;gap:6px">
        <span class="author-av">${f.authorInitials}</span>
        <strong>${escHtml(f.author)}</strong>
      </span>
      <span>·</span>
      <span>${relativeTime(f.postedAt)}</span>
      <span>·</span>
      <span>${wc} words · ${readMin} min read</span>
    </div>
    ${f.tag ? `<div class="article-tags"><span class="tag-pill">${escHtml(f.tag)}</span></div>` : ''}
    <div class="article-divider"></div>
    <div class="article-content">${paragraphs}</div>

    <div class="reaction-bar">
      <button class="react-btn ${f.liked?'liked':''}" onclick="reactFeature('${f.id}','like')">
        <svg width="15" height="15" fill="${f.liked?'currentColor':'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>
        ${f.likes} likes
      </button>
      <button class="react-btn ${f.disliked?'disliked':''}" onclick="reactFeature('${f.id}','dislike')">
        <svg width="15" height="15" fill="${f.disliked?'currentColor':'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"/></svg>
        ${f.dislikes} dislikes
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

// 7. ── DATABASE MUTATIONS (CRUD to Firebase) ──
window.publishFeature = () => {
  const title = document.getElementById('pubTitle').value.trim();
  const content = document.getElementById('pubContent').value.trim();
  const tag = document.getElementById('pubTag').value.trim();
  
  if (!title || !content) { 
    if(!title) document.getElementById('pubTitle').focus(); 
    else document.getElementById('pubContent').focus(); 
    return; 
  }
  
  // 1. Create a new unique ID in Firebase
  const newFeatureRef = push(ref(db, 'features'));
  
  // 2. Set the data
  set(newFeatureRef, {
    title, 
    content, 
    tag, 
    author: 'Kartikeya Pant', 
    authorInitials: 'KP', 
    postedAt: Date.now(), // Store as a number timestamp
    likes: 0, 
    dislikes: 0, 
    liked: false, 
    disliked: false
    // Note: We don't need to push empty arrays for comments/reactions, 
    // Firebase creates them automatically when items are added.
  });

  // 3. Clean up UI
  document.getElementById('pubTitle').value = '';
  document.getElementById('pubContent').value = '';
  document.getElementById('pubTag').value = '';
  document.getElementById('wordCount').textContent = '0 words';
  window.closeModal('publishModal');
};

window.reactFeature = (id, type) => {
  const f = features.find(x => x.id === id);
  if (!f) return;
  
  // We make a copy of the state to mutate, then push the whole block
  let { likes, dislikes, liked, disliked, reactions } = f;

  if (type === 'like') {
    if (liked) { 
      liked = false; 
      likes--; 
      reactions = reactions.filter(r => !(r.name === 'Kartikeya Pant' && r.type === '👍')); 
    } else { 
      liked = true; 
      likes++; 
      if(disliked) {
        disliked = false;
        dislikes--;
        reactions = reactions.filter(r => !(r.name === 'Kartikeya Pant' && r.type === '👎'));
      } 
      reactions.push({name: 'Kartikeya Pant', initials: 'KP', type: '👍'}); 
    }
  } else {
    if (disliked) { 
      disliked = false; 
      dislikes--; 
      reactions = reactions.filter(r => !(r.name === 'Kartikeya Pant' && r.type === '👎')); 
    } else { 
      disliked = true; 
      dislikes++; 
      if(liked) {
        liked = false;
        likes--;
        reactions = reactions.filter(r => !(r.name === 'Kartikeya Pant' && r.type === '👍'));
      } 
      reactions.push({name: 'Kartikeya Pant', initials: 'KP', type: '👎'}); 
    }
  }
  
  // Push updated reaction data to Firebase
  update(ref(db, `features/${id}`), { likes, dislikes, liked, disliked, reactions });
};

window.openReactions = (id) => {
  const f = features.find(x => x.id === id);
  if (!f) return;
  const html = f.reactions.length
    ? f.reactions.map(r=>`<div class="reaction-row"><div class="avatar-sm">${r.initials}</div>${escHtml(r.name)}<span class="reaction-type">${r.type}</span></div>`).join('')
    : '<p style="color:#9ca3af;font-size:14px;padding:12px 0">No reactions yet.</p>';
  document.getElementById('reactionsList').innerHTML = html;
  window.openModal('reactionsModal');
};

window.postComment = (featureId) => {
  const input = document.getElementById('newCommentInput');
  if (!input || !input.value.trim()) return;
  
  const newCommentRef = push(ref(db, `features/${featureId}/comments`));
  set(newCommentRef, {
    author: 'Kartikeya Pant', 
    initials: 'KP', 
    text: input.value.trim(), 
    postedAt: Date.now(), 
    likes: 0, 
    liked: false
  });
  
  input.value = '';
};

window.likeComment = (featureId, commentId) => {
  const f = features.find(x => x.id === featureId); if (!f) return;
  const c = f.comments.find(x => x.id === commentId); if (!c) return;
  
  const newLiked = !c.liked;
  const newLikes = c.likes + (newLiked ? 1 : -1);
  
  update(ref(db, `features/${featureId}/comments/${commentId}`), {
    liked: newLiked,
    likes: newLikes
  });
};

window.deleteComment = (featureId, commentId) => {
  remove(ref(db, `features/${featureId}/comments/${commentId}`));
};

window.openEditModal = () => {
  const f = features.find(x => x.id === currentFeatureId);
  if (!f) return;
  document.getElementById('editTitle').value = f.title;
  document.getElementById('editTag').value = f.tag || '';
  document.getElementById('editContent').value = f.content;
  document.getElementById('editWordCount').textContent = wordCount(f.content) + ' words';
  window.openModal('editModal');
};

window.saveEdit = () => {
  const f = features.find(x => x.id === currentFeatureId);
  if (!f) return;
  
  const updatedData = {
    title: document.getElementById('editTitle').value.trim() || f.title,
    tag: document.getElementById('editTag').value.trim(),
    content: document.getElementById('editContent').value.trim() || f.content
  };
  
  update(ref(db, `features/${currentFeatureId}`), updatedData).then(() => {
    window.closeModal('editModal');
  });
};

window.deleteFeature = () => {
  if (currentFeatureId) {
    remove(ref(db, `features/${currentFeatureId}`)).then(() => {
      window.closeModal('confirmModal');
      window.showList();
    });
  }
};