// ── DATA ──
let features = [
  {
    id: 1,
    title: "The Fed's Tightrope: Navigating Inflation Without Triggering Recession",
    content: `The Federal Reserve finds itself in a position familiar to central bankers throughout modern economic history — caught between the twin mandates of price stability and maximum employment, with the tools to achieve both but the ability to perfectly calibrate neither.

Since early 2022, the Fed has engaged in one of the most aggressive rate-hiking cycles in decades. The federal funds rate, held near zero throughout the pandemic, was elevated to over 5% in a span of eighteen months. The objective was clear: bring inflation — which peaked near 9% in mid-2022 — back toward the 2% target. The mechanism is equally clear in theory: higher rates increase the cost of borrowing, cool demand, and ultimately relieve upward price pressure.

But economic policy is not a controlled experiment. The transmission of monetary policy is uncertain, non-linear, and subject to lags that can stretch anywhere from six months to two years. By the time the full effects of a rate hike are felt in the real economy, the conditions that motivated it may have already reversed.

This is the Fed's fundamental challenge. Raise rates too aggressively and risk tipping a slowing economy into outright recession — increasing unemployment, stressing indebted households and businesses, and potentially causing financial instability. Move too cautiously and allow inflation expectations to become unanchored, recreating the stagflationary conditions of the 1970s that required Paul Volcker's painful 20% rates to finally break.

The current data presents a mixed picture. Headline inflation has moderated substantially, but core services inflation — heavily influenced by shelter costs and wage dynamics — has proven stickier than anticipated. Meanwhile, the labor market, while softening at the margins, remains historically tight by most measures.

The debate within the economics profession centers on a key empirical question: is the last mile of disinflation — bringing inflation from 3% to 2% — meaningfully harder than the first? If so, the Fed may need to hold rates higher for longer than financial markets currently anticipate, accepting more unemployment as the price of credibility.

What is undeniable is that monetary policy alone cannot solve structurally driven inflation. Supply chains, energy markets, housing shortages, and labor force dynamics all play significant roles that lie outside the Fed's toolkit entirely. The institution's power, while substantial, is not unlimited — and the clearest lesson of the past three years may be that the interaction between fiscal and monetary policy, and between domestic and global economic forces, is more consequential than any single central bank's decisions.`,
    author: "Kartikeya Pant", authorInitials: "KP",
    tag: "fed-policy", postedAt: new Date(Date.now() - 9 * 3600000),
    likes: 1, dislikes: 0, liked: false, disliked: false,
    reactions: [{ name: "Kartikeya Pant", initials: "KP", type: "👍" }],
    comments: []
  }
];

let currentFeatureId = null;

// ── HELPERS ──
function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function relativeTime(date) {
  const s = Math.floor((Date.now() - date) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s/60) + ' min ago';
  if (s < 86400) return Math.floor(s/3600) + ' hours ago';
  return Math.floor(s/86400) + ' days ago';
}

function wordCount(text) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function updateWordCount() {
  const c = document.getElementById('pubContent').value;
  document.getElementById('wordCount').textContent = wordCount(c) + ' words';
}
function updateEditWordCount() {
  const c = document.getElementById('editContent').value;
  document.getElementById('editWordCount').textContent = wordCount(c) + ' words';
}

// ── MODAL ──
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-overlay').forEach(o => o.addEventListener('click', e => { if(e.target===o) o.classList.remove('open'); }));

// ── VIEWS ──
function showList() {
  document.getElementById('viewList').classList.add('active');
  document.getElementById('viewArticle').classList.remove('active');
  currentFeatureId = null;
  renderList();
}

function showArticle(id) {
  currentFeatureId = id;
  document.getElementById('viewList').classList.remove('active');
  document.getElementById('viewArticle').classList.add('active');
  renderArticle();
}

// ── RENDER LIST ──
function renderList() {
  const el = document.getElementById('featuresList');
  if (!features.length) {
    el.innerHTML = `<div class="empty-state"><p class="empty-text">No features published yet. Be the first to contribute!</p></div>`;
    return;
  }
  el.innerHTML = features.map(f => {
    const excerpt = f.content.split('\n\n')[0].slice(0, 200) + (f.content.length > 200 ? '…' : '');
    return `
    <div class="feature-card" onclick="showArticle(${f.id})">
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
        <button class="react-btn ${f.liked?'liked':''}" onclick="reactFeature(${f.id},'like')">
          <svg width="14" height="14" fill="${f.liked?'currentColor':'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>
          ${f.likes}
        </button>
        <button class="react-btn ${f.disliked?'disliked':''}" onclick="reactFeature(${f.id},'dislike')">
          <svg width="14" height="14" fill="${f.disliked?'currentColor':'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"/></svg>
          ${f.dislikes}
        </button>
        <span class="see-reactions" onclick="openReactions(${f.id})">See reactions</span>
      </div>
    </div>`;
  }).join('');
}

// ── RENDER ARTICLE ──
function renderArticle() {
  const f = features.find(x => x.id === currentFeatureId);
  if (!f) return showList();

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
              <button class="comment-action ${c.liked?'liked':''}" onclick="likeComment(${f.id},${c.id})">
                <svg width="12" height="12" fill="${c.liked?'currentColor':'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/></svg>
                ${c.likes}
              </button>
              <button class="comment-action delete-comment" onclick="deleteComment(${f.id},${c.id})">
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
      <button class="react-btn ${f.liked?'liked':''}" onclick="reactFeature(${f.id},'like'); renderArticle()">
        <svg width="15" height="15" fill="${f.liked?'currentColor':'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>
        ${f.likes} likes
      </button>
      <button class="react-btn ${f.disliked?'disliked':''}" onclick="reactFeature(${f.id},'dislike'); renderArticle()">
        <svg width="15" height="15" fill="${f.disliked?'currentColor':'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"/></svg>
        ${f.dislikes} dislikes
      </button>
      <span class="reaction-count">${f.reactions.length} reaction${f.reactions.length!==1?'s':''} &nbsp;·&nbsp; <span style="color:var(--gold);cursor:pointer" onclick="openReactions(${f.id})">See all</span></span>
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
          <button class="btn-post-comment" onclick="postComment(${f.id})">Post Comment</button>
        </div>
      </div>
    </div>`;
}

// ── REACTIONS ──
function reactFeature(id, type) {
  const f = features.find(x=>x.id===id);
  if (!f) return;
  if (type==='like') {
    if (f.liked) { f.liked=false; f.likes--; f.reactions=f.reactions.filter(r=>!(r.name==='Kartikeya Pant'&&r.type==='👍')); }
    else { f.liked=true; f.likes++; if(f.disliked){f.disliked=false;f.dislikes--;f.reactions=f.reactions.filter(r=>!(r.name==='Kartikeya Pant'&&r.type==='👎'));} f.reactions.push({name:'Kartikeya Pant',initials:'KP',type:'👍'}); }
  } else {
    if (f.disliked) { f.disliked=false; f.dislikes--; f.reactions=f.reactions.filter(r=>!(r.name==='Kartikeya Pant'&&r.type==='👎')); }
    else { f.disliked=true; f.dislikes++; if(f.liked){f.liked=false;f.likes--;f.reactions=f.reactions.filter(r=>!(r.name==='Kartikeya Pant'&&r.type==='👍'));} f.reactions.push({name:'Kartikeya Pant',initials:'KP',type:'👎'}); }
  }
  if (currentFeatureId===id) renderArticle();
  else renderList();
}

function openReactions(id) {
  const f = features.find(x=>x.id===id);
  if (!f) return;
  const html = f.reactions.length
    ? f.reactions.map(r=>`<div class="reaction-row"><div class="avatar-sm">${r.initials}</div>${escHtml(r.name)}<span class="reaction-type">${r.type}</span></div>`).join('')
    : '<p style="color:#9ca3af;font-size:14px;padding:12px 0">No reactions yet.</p>';
  document.getElementById('reactionsList').innerHTML = html;
  openModal('reactionsModal');
}

// ── COMMENTS ──
function postComment(featureId) {
  const f = features.find(x=>x.id===featureId);
  const input = document.getElementById('newCommentInput');
  if (!f || !input || !input.value.trim()) return;
  f.comments.push({ id: Date.now(), author: 'Kartikeya Pant', initials: 'KP', text: input.value.trim(), postedAt: new Date(), likes: 0, liked: false });
  renderArticle();
}

function likeComment(featureId, commentId) {
  const f = features.find(x=>x.id===featureId);
  if (!f) return;
  const c = f.comments.find(x=>x.id===commentId);
  if (!c) return;
  c.liked = !c.liked;
  c.likes += c.liked ? 1 : -1;
  renderArticle();
}

function deleteComment(featureId, commentId) {
  const f = features.find(x=>x.id===featureId);
  if (!f) return;
  f.comments = f.comments.filter(c=>c.id!==commentId);
  renderArticle();
}

// ── PUBLISH ──
function publishFeature() {
  const title = document.getElementById('pubTitle').value.trim();
  const content = document.getElementById('pubContent').value.trim();
  const tag = document.getElementById('pubTag').value.trim();
  if (!title || !content) { if(!title) document.getElementById('pubTitle').focus(); else document.getElementById('pubContent').focus(); return; }
  features.unshift({ id: Date.now(), title, content, tag, author: 'Kartikeya Pant', authorInitials: 'KP', postedAt: new Date(), likes: 0, dislikes: 0, liked: false, disliked: false, reactions: [], comments: [] });
  document.getElementById('pubTitle').value = '';
  document.getElementById('pubContent').value = '';
  document.getElementById('pubTag').value = '';
  document.getElementById('wordCount').textContent = '0 words';
  closeModal('publishModal');
  renderList();
}

// ── EDIT ──
function openEditModal() {
  const f = features.find(x=>x.id===currentFeatureId);
  if (!f) return;
  document.getElementById('editTitle').value = f.title;
  document.getElementById('editTag').value = f.tag || '';
  document.getElementById('editContent').value = f.content;
  document.getElementById('editWordCount').textContent = wordCount(f.content) + ' words';
  openModal('editModal');
}

function saveEdit() {
  const f = features.find(x=>x.id===currentFeatureId);
  if (!f) return;
  f.title = document.getElementById('editTitle').value.trim() || f.title;
  f.tag   = document.getElementById('editTag').value.trim();
  f.content = document.getElementById('editContent').value.trim() || f.content;
  closeModal('editModal');
  renderArticle();
}

// ── DELETE ──
function openConfirmDelete() { openModal('confirmModal'); }

function deleteFeature() {
  features = features.filter(x=>x.id!==currentFeatureId);
  closeModal('confirmModal');
  showList();
}

// ── INIT ──
renderList();