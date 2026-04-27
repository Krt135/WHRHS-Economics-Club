// 1. ── IMPORTS & FIREBASE SETUP ──
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, push, set, onValue, remove, update, get } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { firebaseConfig } from './config.js';

const app  = initializeApp(firebaseConfig);
const db   = getDatabase(app);
const auth = getAuth(app);

// 2. ── AUTH STATE ──
let currentUser  = null;
let userRole     = "public";
let userProfile  = null;

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
    userRole    = "public";
    userProfile = null;
  }
  if (currentPostId) renderArticle(); else renderList();
});

// 3. ── GLOBAL STATE ──
let posts         = [];
let currentPostId = sessionStorage.getItem("openPerspective") || null; 
let activeTag = 'all';
let sortMode      = 'newest';
let pendingImgData = null;
let editImgData    = null;

const COLOURS = ['#0f1f3d','#1a2e52','#7c3aed','#0369a1','#065f46','#92400e','#9f1239'];
function avatarColour(name) { let h=0; for(let c of (name||'')) h=(h*31+c.charCodeAt(0))%COLOURS.length; return COLOURS[h]; }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function rel(date) {
  const s=Math.floor((Date.now()-date)/1000);
  if(s<60)return'just now'; if(s<3600)return Math.floor(s/60)+' min ago';
  if(s<86400)return Math.floor(s/3600)+' hours ago'; return Math.floor(s/86400)+' days ago';
}

// NEW HELPER: Automatically gets the best name to display
function getDisplayName() {
  if (userProfile && userProfile.displayName) {
    return userProfile.displayName;
  }
  if (currentUser && currentUser.email) {
    return currentUser.email.split("@")[0];
  }
  return "Member";
}

// Per-user like helpers
function myLiked(p)    { return !!(currentUser && p.userLikes    && p.userLikes[currentUser.uid]); }
function myDisliked(p) { return !!(currentUser && p.userDislikes && p.userDislikes[currentUser.uid]); }

// 4. ── WINDOW BINDINGS ──
window.openModal  = (id) => { document.getElementById(id).classList.add('open'); };
window.closeModal = (id) => { document.getElementById(id).classList.remove('open'); };
document.querySelectorAll('.modal-overlay').forEach(o => o.addEventListener('click', e => { if(e.target===o) o.classList.remove('open'); }));

window.wc = (textareaId, countId) => {
  const v = document.getElementById(textareaId).value;
  document.getElementById(countId).textContent = (v.trim() ? v.trim().split(/\s+/).length : 0) + ' words';
};

window.previewImg = (input, previewId, dataKey) => {
  const file = input.files[0]; if(!file) return;
  const r = new FileReader();
  r.onload = e => {
    if(dataKey==='wImgData') pendingImgData = e.target.result;
    else editImgData = e.target.result;
    document.getElementById(previewId).textContent = '📎 ' + file.name;
  };
  r.readAsDataURL(file);
};

window.showList = () => {
  document.getElementById('viewList').classList.add('active');
  document.getElementById('viewArticle').classList.remove('active');
  currentPostId = null; renderList();
};
window.showArticle = (id) => {
  currentPostId = id;
  document.getElementById('viewList').classList.remove('active');
  document.getElementById('viewArticle').classList.add('active');
  renderArticle();
};
window.filterTag = (btn, tag) => {
  activeTag = tag;
  document.querySelectorAll('.filter-tag').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active'); renderList();
};
window.sortPosts = (mode) => { sortMode = mode; renderList(); };

window.togglePin = async (id, alreadyPinned) => {
  if (alreadyPinned) {
    const snap = await get(ref(db, "bulletin"));
    const data = snap.val() || {};
    // Find the specific bulletin entry matching this perspective ID
    const entry = Object.entries(data).find(([, v]) => v.originalId === id && v.type === 'perspective');
    if (entry) await remove(ref(db, `bulletin/${entry[0]}`));
  } else {
    const p = posts.find(x => x.id === id);
    if (!p) return;
    
    const commentCount = p.comments ? p.comments.length : 0;
    const name = getDisplayName();

    await set(push(ref(db, "bulletin")), {
      originalId: id,
      type: 'perspective', // We tag it so the bulletin knows where it came from
      title: p.title,
      body: p.content || "",
      author: p.author,
      authorInitials: p.authorInitials || "?",
      tags: p.tags || [],
      postedAt: p.postedAt,
      commentCount,
      pinnedAt: Date.now(),
      pinnedBy: name
    });
  }
  // Re-render to update the button UI
  renderArticle();
};

// 5. ── FIREBASE LISTENER ──
onValue(ref(db, 'perspectives'), (snapshot) => {
  const data = snapshot.val();
  console.log("Firebase Data Received:", data ? "Success" : "Empty"); // Debugging log

  if (data) {
    posts = Object.keys(data).map(key => {
      const post = data[key];
      const commentsArray = post.comments ? Object.keys(post.comments).map(cId => ({ id: cId, ...post.comments[cId] })) : [];
      return { id: key, ...post, comments: commentsArray, tags: post.tags || [], postedAt: post.postedAt };
    });

    // Check if our currentPostId actually exists in the data we just got
    if (currentPostId) {
      const postExists = posts.find(p => p.id === currentPostId);
      if (postExists) {
        console.log("Post found, rendering article:", currentPostId);
        // We found it! Now we can safely clear the session storage
        sessionStorage.removeItem("openPerspective");
      } else {
        console.warn("Target ID not found in posts, defaulting to list.");
        currentPostId = null;
      }
    }
  } else {
    posts = [];
  }

  // Final render decision
  if (currentPostId) {
    // Force the view switch before rendering
    document.getElementById('viewList').classList.remove('active');
    document.getElementById('viewArticle').classList.add('active');
    renderArticle();
  } else {
    renderList();
  }
});

// 6. ── RENDER FUNCTIONS ──
function rebuildFilterBar() {
  const bar = document.getElementById('filterBar'); if(!bar) return;
  const allTags = [...new Set(posts.flatMap(p=>p.tags))].sort();
  bar.innerHTML = `<span class="filter-label">FILTER:</span>
    <button class="filter-tag ${activeTag==='all'?'active':''}" onclick="filterTag(this,'all')">All</button>
    ${allTags.map(t=>`<button class="filter-tag ${activeTag===t?'active':''}" onclick="filterTag(this,'${t}')">${esc(t)}</button>`).join('')}`;
}

function renderList() {
  rebuildFilterBar();
  const searchInput = document.getElementById('searchInput');
  const q = searchInput ? searchInput.value.toLowerCase() : '';

  let filtered = posts.filter(p => {
    const matchTag = activeTag === 'all' || (p.tags && p.tags.includes(activeTag));
    // Added safety check for p.tags.some
    const matchSearch = !q || 
                        p.title.toLowerCase().includes(q) || 
                        p.author.toLowerCase().includes(q) || 
                        (p.tags && p.tags.some(t => t.toLowerCase().includes(q)));
    return matchTag && matchSearch;
  });

  // Sorting
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
    // Safer excerpt generation
    const excerpt = p.content ? (p.content.split('\n\n')[0].slice(0, 240) + (p.content.length > 240 ? '…' : '')) : '';

    // THEME LOGIC
    const cardTheme = (currentUser && p.authorId === currentUser.uid) ? "theme-me" 
                    : (p.authorRole === "admin") ? "theme-exec" 
                    : "theme-member";

    return `
    <div class="persp-card ${cardTheme}" onclick="showArticle('${p.id}')">
      <div class="pc-header">
        <div class="pc-title">${esc(p.title)}</div>
        ${p.featured ? `<span class="featured-badge">FEATURED</span>` : ''}
      </div>
      
      ${p.image ? `<img src="${p.image}" class="pc-image" alt="Post Image" loading="lazy">` : ''}
      
      <div class="pc-excerpt">${esc(excerpt)}</div>
      
      <div class="pc-meta">
        <span class="author-chip">
          <span class="author-av" style="background:${avatarColour(p.author)}">${esc(p.authorInitials || '?')}</span>
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

function renderArticle() {
  const p = posts.find(x => x.id === currentPostId); if (!p) return window.showList();
  const wds     = p.content.trim().split(/\s+/).length;
  const readMin = Math.max(1, Math.round(wds / 200));
  const paragraphs = p.content.split(/\n\n+/).map(s => `<p>${esc(s.trim())}</p>`).join('');
  const iLiked     = myLiked(p);
  const iDisliked  = myDisliked(p);
  const mainTheme = (currentUser && p.authorId === currentUser.uid) ? "theme-me" 
                  : (p.authorRole === "admin") ? "theme-exec" 
                  : "theme-member";

  const canModify = currentUser && (p.authorId === currentUser.uid || userRole === 'admin');
  const isAdmin = userRole === 'admin';

  get(ref(db, "bulletin")).then(snap => {
    const bulletinData = snap.val() || {};
    const alreadyPinned = Object.values(bulletinData).some(b => b.originalId === p.id && b.type === 'perspective');

    document.getElementById('articleTopActions').innerHTML = `
      ${canModify ? `
        <button class="topbar-btn btn-edit" onclick="openEditModal()">
          <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Edit
        </button>
        <button class="topbar-btn btn-delete" onclick="openModal('confirmModal')">
          <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>Delete
        </button>` : ''}
      ${isAdmin ? `
        <button class="topbar-btn btn-pin-tb ${alreadyPinned ? "pinned" : ""}" onclick="window.togglePin('${p.id}', ${alreadyPinned})">
          <svg width="13" height="13" fill="${alreadyPinned ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
          ${alreadyPinned ? "Unpin" : "Pin to Bulletin"}
        </button>` : ''}`;
  });

  const commentsHtml = p.comments.length
    ? p.comments.map(c => {
        // --- NEW INDIVIDUAL LIKE LOGIC ---
        const totalCommentLikes = c.userLikes ? Object.keys(c.userLikes).length : 0;
        const amILiked = currentUser && c.userLikes && c.userLikes[currentUser.uid];
        // ---------------------------------

        const canDeleteComment = currentUser && (c.authorId === currentUser.uid || userRole === 'admin');
        const commentTheme = (currentUser && c.authorId === currentUser.uid) ? "theme-me" : "theme-member";
        
        return `
        <div class="comment-item ${commentTheme}">
          <div class="comment-av" style="background:${avatarColour(c.author)}">${esc(c.initials||'?')}</div>
          <div class="comment-bubble">
            <div class="comment-header">
              <span class="comment-author-name">${esc(c.author)}</span>
              <span class="comment-time">${rel(c.postedAt)}</span>
            </div>
            <div class="comment-bubble-text">${esc(c.text)}</div>
            <div class="comment-bubble-actions">
              <button class="comment-action ${amILiked ? 'liked' : ''}" onclick="likeComment('${p.id}','${c.id}')">
                <svg width="12" height="12" fill="${amILiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/></svg>
                ${totalCommentLikes}
              </button>
              ${canDeleteComment?`
              <button class="comment-action delete-comment" onclick="deleteComment('${p.id}','${c.id}')">
                <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 6 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>Delete
              </button>`:''}
            </div>
          </div>
        </div>`;
      }).join('')
    : '<p style="font-style:italic;color:#9ca3af;font-size:15px">No comments yet. Share your thoughts!</p>';

  document.getElementById('articleBody').className = `article-body article-container ${mainTheme}`;
  document.getElementById('articleBody').innerHTML = `
    <div class="article-eyebrow">PERSPECTIVES${p.tags.length ? ' · ' + p.tags[0].toUpperCase() : ''}</div>
    <div class="article-title">${esc(p.title)}</div>
    <div class="article-meta">
      <span class="author-chip" style="display:flex;align-items:center;gap:6px">
        <span class="author-av" style="background:${avatarColour(p.author)};width:24px;height:24px;font-size:9px">${esc(p.authorInitials||'?')}</span>
        <strong>${esc(p.author)}</strong>
      </span>
      <span>·</span><span>${rel(p.postedAt)}</span><span>·</span>
      <span>${wds} words · ${readMin} min read</span>
    </div>
    ${p.tags.length ? `<div class="article-tags">${p.tags.map(t => `<span class="tag-pill">${esc(t)}</span>`).join('')}</div>` : ''}
    <div class="article-divider"></div>
    ${p.image ? `<img src="${p.image}" class="article-img" alt="">` : ''}
    <div class="article-content">${paragraphs}</div>
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
  const title   = document.getElementById('wTitle').value.trim();
  const content = document.getElementById('wContent').value.trim();
  const tagsRaw = document.getElementById('wTags').value.trim();
  if(!title){document.getElementById('wTitle').focus();return;}
  if(!content){document.getElementById('wContent').focus();return;}
  
  const name = getDisplayName();
  const tags = tagsRaw ? tagsRaw.split(',').map(t=>t.trim()).filter(Boolean) : [];

  set(push(ref(db,'perspectives')),{
    title, 
    content, 
    tags,
    author: name, 
    authorInitials: name.substring(0,2).toUpperCase(), 
    authorId: currentUser.uid,
    authorRole: userRole, // <--- ADD THIS LINE
    image: pendingImgData||null, 
    postedAt: Date.now(),
    likes: 0, 
    dislikes: 0, 
    featured: false
  });
  pendingImgData=null;
  document.getElementById('wTitle').value='';
  document.getElementById('wContent').value='';
  document.getElementById('wTags').value='';
  document.getElementById('wImgPreview').textContent='';
  document.getElementById('wWC').textContent='0 words';
  window.closeModal('writeModal');
};

window.react = (id, type) => {
  if (!currentUser) return alert("Please log in to react.");
  const p = posts.find(x => x.id === id); 
  if (!p) return;
  
  const uid = currentUser.uid;
  const wasLiked    = !!(p.userLikes    && p.userLikes[uid]);
  const wasDisliked = !!(p.userDislikes && p.userDislikes[uid]);
  let likes    = p.likes    || 0;
  let dislikes = p.dislikes || 0;

  // 1. Target the specific post, NOT the root db
  const postRef = ref(db, `perspectives/${id}`);
  const updates = {}; // Keys will now be relative to the post

  if (type === 'like') {
    if (wasLiked) { 
      updates[`userLikes/${uid}`] = null; 
      likes--; 
    } else {
      updates[`userLikes/${uid}`] = true; 
      likes++;
      if (wasDisliked) { 
        updates[`userDislikes/${uid}`] = null; 
        dislikes--; 
      }
    }
  } else {
    if (wasDisliked) { 
      updates[`userDislikes/${uid}`] = null; 
      dislikes--; 
    } else {
      updates[`userDislikes/${uid}`] = true; 
      dislikes++;
      if (wasLiked) { 
        updates[`userLikes/${uid}`] = null; 
        likes--; 
      }
    }
  }

  // Update the counters
  updates[`likes`] = likes;
  updates[`dislikes`] = dislikes;
  
  // 2. Execute the update specifically on this post
  update(postRef, updates).catch(err => console.error("Reaction error:", err));
};

window.postComment = (postId) => {
  if (!currentUser) return alert("Please log in to comment.");
  const inp = document.getElementById('cmtInput');
  if (!inp||!inp.value.trim()) return;
  const name = getDisplayName();
  set(push(ref(db,`perspectives/${postId}/comments`)),{
    author: name, initials: name.substring(0,2).toUpperCase(),
    authorId: currentUser.uid, text: inp.value.trim(),
    postedAt: Date.now(), likes: 0, liked: false
  });
  inp.value='';
};

window.likeComment = async (postId, cmtId) => {
  if (!auth.currentUser) {
    alert("Please log in to like comments.");
    return;
  }

  const uid = auth.currentUser.uid;
  const p = posts.find(x => x.id === postId); if (!p) return;
  const c = p.comments.find(x => x.id === cmtId); if (!c) return;

  // Check if this specific user is in the userLikes object
  const hasLiked = c.userLikes && c.userLikes[uid];
  const likeRef = ref(db, `perspectives/${postId}/comments/${cmtId}/userLikes/${uid}`);

  if (hasLiked) {
    await remove(likeRef);
  } else {
    await set(likeRef, true);
  }
};

window.deleteComment = (postId, cmtId) => {
  if (confirm("Delete this comment?")) remove(ref(db,`perspectives/${postId}/comments/${cmtId}`));
};

window.openEditModal = () => {
  const p=posts.find(x=>x.id===currentPostId); if(!p) return;
  document.getElementById('eTitle').value   = p.title;
  document.getElementById('eContent').value = p.content;
  document.getElementById('eTags').value    = p.tags.join(', ');
  document.getElementById('eWC').textContent = p.content.trim().split(/\s+/).length+' words';
  document.getElementById('eImgPreview').textContent='';
  editImgData=null;
  window.openModal('editModal');
};

window.saveEdit = () => {
  const p=posts.find(x=>x.id===currentPostId); if(!p) return;
  const updatedData={
    title:   document.getElementById('eTitle').value.trim()||p.title,
    content: document.getElementById('eContent').value.trim()||p.content,
    tags:    document.getElementById('eTags').value.split(',').map(t=>t.trim()).filter(Boolean)
  };
  if(editImgData) updatedData.image=editImgData;
  update(ref(db,`perspectives/${currentPostId}`),updatedData).then(()=>window.closeModal('editModal'));
};

window.deletePost = () => {
  if(currentPostId){
    remove(ref(db,`perspectives/${currentPostId}`)).then(()=>{window.closeModal('confirmModal');window.showList();});
  }
};

