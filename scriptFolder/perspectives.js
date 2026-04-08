// ── COLOUR PALETTE for author avatars ──
const COLOURS = ['#0f1f3d','#1a2e52','#7c3aed','#0369a1','#065f46','#92400e','#9f1239'];
function avatarColour(name) { let h=0; for(let c of name) h=(h*31+c.charCodeAt(0))%COLOURS.length; return COLOURS[h]; }

// ── DATA ──
let posts = [
  {
    id: 1, title: "Why the Gig Economy Isn't as Free as It Looks",
    content: `The rise of platform-mediated gig work — Uber, DoorDash, Fiverr, TaskRabbit — is often celebrated as the democratization of labor. Workers set their own hours, choose their clients, and escape the tyranny of the nine-to-five. The narrative is seductive. The economics, however, are more complicated.

Gig work externalizes virtually every cost of employment onto the worker. Benefits, payroll taxes, equipment, insurance, professional development — all transferred from the employer's balance sheet to the individual. The platform captures the economic surplus of the match (connecting supply and demand efficiently) while bearing none of the traditional obligations of an employer.

From a macroeconomic standpoint, this represents a structural shift in how labor income is distributed. When workers are reclassified as contractors, their bargaining power collapses. There is no minimum wage floor, no overtime protection, no right to organize. The platform can reprice their labor downward with an algorithm update.

The economic freedom of gig work is real at the margin — it suits parents needing flexibility, students earning supplemental income, retirees who want part-time engagement. But as a replacement for stable employment, it represents a deterioration in the quality of work, not an improvement in its nature.

The policy question is not whether gig work should exist — it clearly serves genuine demand — but whether the current regulatory framework, designed for an industrial economy, adequately protects workers in a platform economy. That is a question our generation will need to answer.`,
    author: "Aryan Shah", authorInitials: "AS",
    tags: ["labor","gig-economy","policy"],
    image: null, postedAt: new Date(Date.now()-2*3600000),
    likes: 6, dislikes: 1, liked: false, disliked: false, featured: true,
    comments: [{ id:1, author:"Kartikeya Pant", initials:"KP", text:"Really sharp analysis. The externalization of costs is the key insight.", postedAt: new Date(Date.now()-1*3600000), likes:2, liked:false }]
  },
  {
    id: 2, title: "What Monopoly the Board Game Gets Wrong About Monopoly the Economic Concept",
    content: `Monopoly teaches us that one player accumulates all the resources and everyone else goes bankrupt. This is a reasonably accurate description of how the game ends, and a catastrophically inaccurate description of how monopolies function in the real economy.

Real monopolies rarely seek to bankrupt their customers — that would eliminate the revenue stream. Instead, they engage in rent extraction: charging prices above the competitive equilibrium while producing less output than a competitive market would. The harm is not visible bankruptcy but invisible inefficiency — goods and services that would have existed in a competitive market simply do not get produced.

The game also misses the dynamic of regulatory capture. Actual monopolists in the 21st century spend enormous resources influencing the regulatory environment — lobbying for favorable legislation, challenging antitrust enforcement, funding think tanks that argue concentration is benign. These are activities that consume real resources and produce no social value, what economists call rent-seeking behavior.

Perhaps most importantly, Monopoly treats the initial distribution of properties as random and fair. Real economic monopolization often has deeply historical roots — network effects that locked in early winners, regulatory decisions that created barriers to entry, and in some cases, straightforward anti-competitive behavior that was not prosecuted.

None of this means Monopoly is a bad game. It is an excellent game for teaching property rights, negotiation, and the compounding power of early advantage. But it should come with a disclaimer: actual antitrust economics is considerably more interesting.`,
    author: "Priya Mehta", authorInitials: "PM",
    tags: ["microeconomics","antitrust","opinion"],
    image: null, postedAt: new Date(Date.now()-18*3600000),
    likes: 11, dislikes: 0, liked: false, disliked: false, featured: false,
    comments: []
  }
];

let currentPostId = null;
let activeTag = 'all';
let sortMode = 'newest';
let pendingImgData = null;
let editImgData = null;
let announceMsg = '';

// ── WORD COUNT ──
function wc(textareaId, countId) {
  const v = document.getElementById(textareaId).value;
  const n = v.trim() ? v.trim().split(/\s+/).length : 0;
  document.getElementById(countId).textContent = n + ' words';
}

// ── IMAGE PREVIEW ──
function previewImg(input, previewId, dataKey) {
  const file = input.files[0]; if(!file) return;
  const r = new FileReader();
  r.onload = e => {
    if(dataKey==='wImgData') pendingImgData = e.target.result;
    else editImgData = e.target.result;
    document.getElementById(previewId).textContent = '📎 ' + file.name;
  };
  r.readAsDataURL(file);
}

// ── MODAL ──
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-overlay').forEach(o => o.addEventListener('click', e => { if(e.target===o) o.classList.remove('open'); }));

// ── VIEWS ──
function showList() {
  document.getElementById('viewList').classList.add('active');
  document.getElementById('viewArticle').classList.remove('active');
  currentPostId = null;
  renderList();
}
function showArticle(id) {
  currentPostId = id;
  document.getElementById('viewList').classList.remove('active');
  document.getElementById('viewArticle').classList.add('active');
  renderArticle();
}

// ── FILTER / SORT / SEARCH ──
function filterTag(btn, tag) {
  activeTag = tag;
  document.querySelectorAll('.filter-tag').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderList();
}
function sortPosts(mode) { sortMode = mode; renderList(); }

function rebuildFilterBar() {
  const bar = document.getElementById('filterBar');
  const allTags = [...new Set(posts.flatMap(p => p.tags))].sort();
  // keep existing buttons that are still valid
  bar.innerHTML = `<span class="filter-label">FILTER:</span>
    <button class="filter-tag ${activeTag==='all'?'active':''}" onclick="filterTag(this,'all')">All</button>
    ${allTags.map(t=>`<button class="filter-tag ${activeTag===t?'active':''}" onclick="filterTag(this,'${t}')">${esc(t)}</button>`).join('')}`;
}

// ── RENDER LIST ──
function renderList() {
  rebuildFilterBar();
  const q = document.getElementById('searchInput').value.toLowerCase();
  let filtered = posts.filter(p => {
    const matchTag = activeTag==='all' || p.tags.includes(activeTag);
    const matchSearch = !q || p.title.toLowerCase().includes(q) || p.author.toLowerCase().includes(q) || p.tags.some(t=>t.includes(q));
    return matchTag && matchSearch;
  });
  if (sortMode==='oldest') filtered.sort((a,b)=>a.postedAt-b.postedAt);
  else if (sortMode==='popular') filtered.sort((a,b)=>b.likes-a.likes);
  else filtered.sort((a,b)=>b.postedAt-a.postedAt);

  const el = document.getElementById('postsList');
  if (!filtered.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-italic">Share your perspective.</div><div class="empty-sub">Write about any topic related to economics — even abstractly.</div></div>`;
    return;
  }
  el.innerHTML = filtered.map(p => {
    const excerpt = p.content.split('\n\n')[0].slice(0,240) + (p.content.length>240?'…':'');
    return `
    <div class="persp-card" onclick="showArticle(${p.id})">
      <div class="pc-header">
        <div class="pc-title">${esc(p.title)}</div>
        ${p.featured ? `<span class="featured-badge">FEATURED</span>` : ''}
      </div>
      ${p.image ? `<img src="${p.image}" class="pc-image" alt="">` : ''}
      <div class="pc-excerpt">${esc(excerpt)}</div>
      <div class="pc-meta">
        <span class="author-chip">
          <span class="author-av" style="background:${avatarColour(p.author)}">${p.authorInitials}</span>
          ${esc(p.author)}
        </span>
        <span>·</span><span>${rel(p.postedAt)}</span>
        <span>·</span>
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        ${p.comments.length}
      </div>
      ${p.tags.length ? `<div class="pc-tags">${p.tags.map(t=>`<span class="tag-pill">${esc(t)}</span>`).join('')}</div>` : ''}
      <div class="pc-actions" onclick="event.stopPropagation()">
        <button class="react-btn ${p.liked?'liked':''}" onclick="react(${p.id},'like')">
          <svg width="14" height="14" fill="${p.liked?'currentColor':'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>
          ${p.likes}
        </button>
        <button class="react-btn ${p.disliked?'disliked':''}" onclick="react(${p.id},'dislike')">
          <svg width="14" height="14" fill="${p.disliked?'currentColor':'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"/></svg>
          ${p.dislikes}
        </button>
      </div>
    </div>`;
  }).join('');
}

// ── RENDER ARTICLE ──
function renderArticle() {
  const p = posts.find(x=>x.id===currentPostId); if(!p) return showList();
  const wds = p.content.trim().split(/\s+/).length;
  const readMin = Math.max(1,Math.round(wds/200));
  const paragraphs = p.content.split(/\n\n+/).map(s=>`<p>${esc(s.trim())}</p>`).join('');

  // Only show edit/delete for the author (KP in this demo)
  const isAuthor = p.author==='Kartikeya Pant';
  document.getElementById('articleTopActions').innerHTML = isAuthor ? `
    <button class="topbar-btn btn-edit" onclick="openEditModal()">
      <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Edit
    </button>
    <button class="topbar-btn btn-delete" onclick="openModal('confirmModal')">
      <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>Delete
    </button>` : '';

  const commentsHtml = p.comments.length
    ? p.comments.map(c=>`
        <div class="comment-item">
          <div class="comment-av" style="background:${avatarColour(c.author)}">${c.initials}</div>
          <div class="comment-bubble">
            <div class="comment-header">
              <span class="comment-author">${esc(c.author)}</span>
              <span class="comment-time">${rel(c.postedAt)}</span>
            </div>
            <div class="comment-text">${esc(c.text)}</div>
            <div class="comment-actions-row">
              <button class="comment-action ${c.liked?'liked':''}" onclick="likeComment(${p.id},${c.id})">
                <svg width="12" height="12" fill="${c.liked?'currentColor':'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/></svg>
                ${c.likes}
              </button>
              <button class="comment-action del-comment" onclick="deleteComment(${p.id},${c.id})">
                <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>Delete
              </button>
            </div>
          </div>
        </div>`).join('')
    : '<p style="font-style:italic;color:#9ca3af;font-size:15px">No comments yet. Share your thoughts!</p>';

  document.getElementById('articleBody').innerHTML = `
    <div class="article-eyebrow">PERSPECTIVES${p.tags.length?' · '+p.tags[0].toUpperCase():''}</div>
    <div class="article-title">${esc(p.title)}</div>
    <div class="article-meta">
      <span class="author-chip" style="display:flex;align-items:center;gap:6px">
        <span class="author-av" style="background:${avatarColour(p.author)};width:24px;height:24px;font-size:9px">${p.authorInitials}</span>
        <strong>${esc(p.author)}</strong>
      </span>
      <span>·</span><span>${rel(p.postedAt)}</span>
      <span>·</span><span>${wds} words · ${readMin} min read</span>
    </div>
    ${p.tags.length ? `<div class="article-tags">${p.tags.map(t=>`<span class="tag-pill">${esc(t)}</span>`).join('')}</div>` : ''}
    <div class="article-divider"></div>
    ${p.image ? `<img src="${p.image}" class="article-img" alt="">` : ''}
    <div class="article-content">${paragraphs}</div>
    <div class="reaction-bar">
      <button class="react-btn ${p.liked?'liked':''}" onclick="react(${p.id},'like');renderArticle()">
        <svg width="15" height="15" fill="${p.liked?'currentColor':'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>
        ${p.likes} likes
      </button>
      <button class="react-btn ${p.disliked?'disliked':''}" onclick="react(${p.id},'dislike');renderArticle()">
        <svg width="15" height="15" fill="${p.disliked?'currentColor':'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"/></svg>
        ${p.dislikes} dislikes
      </button>
    </div>
    <div class="comments-area">
      <div class="comments-title">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        ${p.comments.length} Comment${p.comments.length!==1?'s':''}
      </div>
      ${commentsHtml}
      <div class="new-comment-box" style="margin-top:20px">
        <textarea class="new-comment-input" id="cmtInput" placeholder="Add a comment..."></textarea>
        <button class="btn-post-comment" onclick="postComment(${p.id})">Post</button>
      </div>
    </div>`;
}

// ── REACTIONS ──
function react(id, type) {
  const p = posts.find(x=>x.id===id); if(!p) return;
  if(type==='like'){
    if(p.liked){p.liked=false;p.likes--;}
    else{p.liked=true;p.likes++;if(p.disliked){p.disliked=false;p.dislikes--;}}
  } else {
    if(p.disliked){p.disliked=false;p.dislikes--;}
    else{p.disliked=true;p.dislikes++;if(p.liked){p.liked=false;p.likes--;}}
  }
  if(currentPostId===id) renderArticle(); else renderList();
}

// ── COMMENTS ──
function postComment(postId) {
  const p=posts.find(x=>x.id===postId);
  const inp=document.getElementById('cmtInput');
  if(!p||!inp||!inp.value.trim()) return;
  p.comments.push({id:Date.now(),author:'Kartikeya Pant',initials:'KP',text:inp.value.trim(),postedAt:new Date(),likes:0,liked:false});
  renderArticle();
}
function likeComment(postId,cmtId) {
  const p=posts.find(x=>x.id===postId); if(!p) return;
  const c=p.comments.find(x=>x.id===cmtId); if(!c) return;
  c.liked=!c.liked; c.likes+=c.liked?1:-1; renderArticle();
}
function deleteComment(postId,cmtId) {
  const p=posts.find(x=>x.id===postId); if(!p) return;
  p.comments=p.comments.filter(c=>c.id!==cmtId); renderArticle();
}

// ── PUBLISH ──
function publishPost() {
  const title=document.getElementById('wTitle').value.trim();
  const content=document.getElementById('wContent').value.trim();
  const tagsRaw=document.getElementById('wTags').value.trim();
  if(!title){document.getElementById('wTitle').focus();return;}
  if(!content){document.getElementById('wContent').focus();return;}
  const tags=tagsRaw?tagsRaw.split(',').map(t=>t.trim()).filter(Boolean):[];
  posts.unshift({id:Date.now(),title,content,author:'Kartikeya Pant',authorInitials:'KP',tags,image:pendingImgData,postedAt:new Date(),likes:0,dislikes:0,liked:false,disliked:false,featured:false,comments:[]});
  pendingImgData=null;
  document.getElementById('wTitle').value='';
  document.getElementById('wContent').value='';
  document.getElementById('wTags').value='';
  document.getElementById('wImgPreview').textContent='';
  document.getElementById('wWC').textContent='0 words';
  closeModal('writeModal');
  renderList();
}

// ── EDIT ──
function openEditModal() {
  const p=posts.find(x=>x.id===currentPostId); if(!p) return;
  document.getElementById('eTitle').value=p.title;
  document.getElementById('eContent').value=p.content;
  document.getElementById('eTags').value=p.tags.join(', ');
  document.getElementById('eWC').textContent=p.content.trim().split(/\s+/).length+' words';
  document.getElementById('eImgPreview').textContent='';
  editImgData=null;
  openModal('editModal');
}
function saveEdit() {
  const p=posts.find(x=>x.id===currentPostId); if(!p) return;
  p.title=document.getElementById('eTitle').value.trim()||p.title;
  p.content=document.getElementById('eContent').value.trim()||p.content;
  p.tags=document.getElementById('eTags').value.split(',').map(t=>t.trim()).filter(Boolean);
  if(editImgData) p.image=editImgData;
  closeModal('editModal');
  renderArticle();
}

// ── DELETE ──
function deletePost() {
  posts=posts.filter(x=>x.id!==currentPostId);
  closeModal('confirmModal');
  showList();
}

// ── ANNOUNCE ──
function postAnnounce() {
  const v=document.getElementById('announceInput').value.trim(); if(!v) return;
  announceMsg=v;
  document.getElementById('announceText').textContent=v;
  document.getElementById('announceInput').value='';
  closeModal('announceModal');
}
function dismissAnnounce() {
  announceMsg='';
  document.getElementById('announceText').textContent='';
}

// ── UTILS ──
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function rel(date){
  const s=Math.floor((Date.now()-date)/1000);
  if(s<60)return'just now';if(s<3600)return Math.floor(s/60)+' min ago';
  if(s<86400)return Math.floor(s/3600)+' hours ago';return Math.floor(s/86400)+' days ago';
}

renderList();