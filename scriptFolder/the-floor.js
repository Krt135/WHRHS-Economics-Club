// ── DATA STORE ──
let discussions = [
  {
    id: 1, title: "Should the Fed prioritize inflation control over employment?",
    body: "With inflation still above the 2% target and unemployment ticking up, the Fed faces a classic dual-mandate tension. Which should take precedence in 2026, and why?",
    author: "Kartikeya Pant", authorInitials: "KP", timeAgo: "2 hours ago",
    tags: ["macroeconomics","fed-policy","debate"],
    image: null, likes: 4, dislikes: 1, liked: false, disliked: false,
    comments: [
      { author: "Aryan S.", initials: "AS", text: "Employment should be the priority given current labor market softness." }
    ],
    commentsOpen: false
  },
  {
    id: 2, title: "Is free trade always beneficial? The case of semiconductor tariffs.",
    body: "Recent U.S. tariffs on semiconductors have reignited the debate about comparative advantage vs. strategic industry protection. Where do you stand?",
    author: "Mia Chen", authorInitials: "MC", timeAgo: "5 hours ago",
    tags: ["trade","macroeconomics"],
    image: null, likes: 7, dislikes: 2, liked: false, disliked: false,
    comments: [], commentsOpen: false
  }
];

let polls = [
  {
    id: 1, question: "Which topic should the next Weekly Feature cover?",
    options: [
      { label: "Central Bank Digital Currencies", votes: 5 },
      { label: "The Economics of Climate Change", votes: 8 },
      { label: "Income Inequality & Redistribution", votes: 3 },
      { label: "Trade Wars & Geopolitics", votes: 4 }
    ],
    votedIndex: null, timeAgo: "1 day ago"
  },
  {
    id: 2, question: "Should the U.S. pursue a universal basic income?",
    options: [
      { label: "Yes — it would reduce poverty", votes: 6 },
      { label: "No — it's fiscally unsustainable", votes: 9 },
      { label: "Maybe — with significant reform", votes: 7 }
    ],
    votedIndex: null, timeAgo: "3 days ago"
  }
];

let attachedImageData = null;
let activeTag = 'all';

// ── RENDER ──
function timeAgo(date) {
  const s = Math.floor((Date.now() - date) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s/60) + ' min ago';
  if (s < 86400) return Math.floor(s/3600) + ' hours ago';
  return Math.floor(s/86400) + ' days ago';
}

function renderDiscussions() {
  const list = document.getElementById('discussionsList');
  const filtered = activeTag === 'all'
    ? discussions
    : discussions.filter(d => d.tags.includes(activeTag));

  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty-state"><p class="empty-text">No discussions yet. Be the first to start one!</p></div>`;
    return;
  }

  list.innerHTML = filtered.map(d => `
    <div class="disc-card" id="disc-${d.id}">
      ${d.image ? `<img src="${d.image}" class="disc-image" alt="Attached image">` : ''}
      <div class="disc-title">${escHtml(d.title)}</div>
      <div class="disc-body">${escHtml(d.body)}</div>
      ${d.tags.length ? `<div class="disc-tags">${d.tags.map(t=>`<span class="tag-pill">${escHtml(t)}</span>`).join('')}</div>` : ''}
      <div class="disc-meta">
        <span class="author">
          <span class="author-av">${d.authorInitials}</span>
          ${escHtml(d.author)}
        </span>
        <span>·</span>
        <span>${d.timeAgo}</span>
        <span>·</span>
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        ${d.comments.length}
      </div>
      <div class="disc-actions">
        <button class="action-btn ${d.liked?'liked':''}" onclick="reactDisc(${d.id},'like')">
          <svg width="14" height="14" fill="${d.liked?'currentColor':'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>
          ${d.likes}
        </button>
        <button class="action-btn ${d.disliked?'disliked':''}" onclick="reactDisc(${d.id},'dislike')">
          <svg width="14" height="14" fill="${d.disliked?'currentColor':'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"/></svg>
          ${d.dislikes}
        </button>
        <button class="action-btn" onclick="toggleComments(${d.id})">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          ${d.comments.length} comment${d.comments.length !== 1 ? 's' : ''}
        </button>
      </div>
      <div class="comments-section ${d.commentsOpen?'open':''}" id="comments-${d.id}">
        <div id="comment-list-${d.id}">
          ${d.comments.map(c=>`
            <div class="comment">
              <div class="comment-av">${c.initials}</div>
              <div class="comment-body">
                <div class="comment-author">${escHtml(c.author)}</div>
                <div class="comment-text">${escHtml(c.text)}</div>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="comment-input-row">
          <textarea class="comment-input" id="cinput-${d.id}" placeholder="Add a comment..." rows="1"></textarea>
          <button class="comment-submit" onclick="submitComment(${d.id})">Post</button>
        </div>
      </div>
    </div>
  `).join('');
}

function renderPolls() {
  const list = document.getElementById('pollsList');
  if (polls.length === 0) {
    list.innerHTML = `<div class="empty-state"><p class="empty-text">No polls yet. Create one!</p></div>`;
    return;
  }

  list.innerHTML = polls.map(p => {
    const totalVotes = p.options.reduce((a,o)=>a+o.votes, 0);
    const optionsHtml = p.options.map((o, i) => {
      const pct = totalVotes ? Math.round(o.votes / totalVotes * 100) : 0;
      const isVoted = p.votedIndex === i;
      const hasVoted = p.votedIndex !== null;
      return `
        <div class="poll-option ${isVoted?'voted-for':''}" onclick="votePoll(${p.id},${i})" style="${hasVoted?'cursor:default':''}">
          <div class="poll-bar ${isVoted?'voted-bar':''}" style="width:${hasVoted?pct:0}%"></div>
          <div class="poll-option-content">
            <div class="poll-option-label">
              ${isVoted ? `<svg class="poll-check" width="16" height="16" fill="none" stroke="#c9a84c" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
              ${escHtml(o.label)}
            </div>
            ${hasVoted ? `<span class="poll-pct ${isVoted?'gold':''}">${pct}%</span>` : ''}
          </div>
        </div>`;
    }).join('');

    return `
      <div class="poll-card">
        <div class="poll-title">
          <svg width="16" height="16" fill="none" stroke="#c9a84c" stroke-width="2" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          ${escHtml(p.question)}
        </div>
        <div class="poll-options">${optionsHtml}</div>
        <div class="poll-footer">
          <span>${p.options.reduce((a,o)=>a+o.votes,0)} vote${p.options.reduce((a,o)=>a+o.votes,0)!==1?'s':''}</span>
          <span>${p.timeAgo}</span>
        </div>
      </div>`;
  }).join('');
}

// ── INTERACTIONS ──
function reactDisc(id, type) {
  const d = discussions.find(x=>x.id===id);
  if (!d) return;
  if (type === 'like') {
    if (d.liked) { d.liked=false; d.likes--; }
    else { d.liked=true; d.likes++; if(d.disliked){d.disliked=false;d.dislikes--;} }
  } else {
    if (d.disliked) { d.disliked=false; d.dislikes--; }
    else { d.disliked=true; d.dislikes++; if(d.liked){d.liked=false;d.likes--;} }
  }
  renderDiscussions();
}

function toggleComments(id) {
  const d = discussions.find(x=>x.id===id);
  if (d) { d.commentsOpen = !d.commentsOpen; renderDiscussions(); }
}

function submitComment(id) {
  const d = discussions.find(x=>x.id===id);
  const input = document.getElementById(`cinput-${id}`);
  if (!d || !input || !input.value.trim()) return;
  d.comments.push({ author: "Kartikeya Pant", initials: "KP", text: input.value.trim() });
  d.commentsOpen = true;
  renderDiscussions();
}

function votePoll(pollId, optIndex) {
  const p = polls.find(x=>x.id===pollId);
  if (!p || p.votedIndex !== null) return;
  p.votedIndex = optIndex;
  p.options[optIndex].votes++;
  renderPolls();
}

function filterByTag(btn, tag) {
  activeTag = tag;
  document.querySelectorAll('.filter-tag').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderDiscussions();
}

function switchTab(tab) {
  document.getElementById('tabDiscussions').classList.toggle('active', tab==='discussions');
  document.getElementById('tabPolls').classList.toggle('active', tab==='polls');
  document.getElementById('panelDiscussions').style.display = tab==='discussions' ? '' : 'none';
  document.getElementById('panelPolls').style.display = tab==='polls' ? '' : 'none';
  document.getElementById('filterBar').style.display = tab==='discussions' ? '' : 'none';
}

// ── MODALS ──
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-overlay').forEach(o => o.addEventListener('click', e => { if(e.target===o) o.classList.remove('open'); }));

// ── PUBLISH DISCUSSION ──
function previewFile(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    attachedImageData = e.target.result;
    document.getElementById('attachPreview').textContent = '📎 ' + file.name;
  };
  reader.readAsDataURL(file);
}

function publishDiscussion() {
  const title = document.getElementById('discTitle').value.trim();
  const body  = document.getElementById('discContent').value.trim();
  const tagsRaw = document.getElementById('discTags').value.trim();
  if (!title) { document.getElementById('discTitle').focus(); return; }
  const tags = tagsRaw ? tagsRaw.split(',').map(t=>t.trim()).filter(Boolean) : [];
  discussions.unshift({
    id: Date.now(), title, body, author: "Kartikeya Pant", authorInitials: "KP",
    timeAgo: "just now", tags, image: attachedImageData,
    likes: 0, dislikes: 0, liked: false, disliked: false,
    comments: [], commentsOpen: false
  });
  // Add any new tags to filter bar
  tags.forEach(t => {
    const existing = [...document.querySelectorAll('.filter-tag')].map(b=>b.dataset?.tag||b.textContent.trim());
    if (!existing.includes(t)) {
      const btn = document.createElement('button');
      btn.className = 'filter-tag';
      btn.textContent = t;
      btn.onclick = () => filterByTag(btn, t);
      document.getElementById('filterBar').appendChild(btn);
    }
  });
  document.getElementById('discTitle').value = '';
  document.getElementById('discContent').value = '';
  document.getElementById('discTags').value = '';
  document.getElementById('attachPreview').textContent = '';
  document.getElementById('fileInput').value = '';
  attachedImageData = null;
  closeModal('discussModal');
  renderDiscussions();
}

// ── PUBLISH POLL ──
function addPollOption() {
  const container = document.getElementById('pollOptionInputs');
  const count = container.children.length + 1;
  const row = document.createElement('div');
  row.className = 'poll-opt-row';
  row.innerHTML = `<input class="form-input" type="text" placeholder="Option ${count}"><button class="remove-opt" onclick="removeOpt(this)" title="Remove">×</button>`;
  container.appendChild(row);
}

function removeOpt(btn) {
  const container = document.getElementById('pollOptionInputs');
  if (container.children.length <= 2) return;
  btn.parentElement.remove();
}

function publishPoll() {
  const question = document.getElementById('pollQuestion').value.trim();
  if (!question) { document.getElementById('pollQuestion').focus(); return; }
  const inputs = [...document.querySelectorAll('#pollOptionInputs .form-input')];
  const options = inputs.map(i=>i.value.trim()).filter(Boolean).map(label=>({label,votes:0}));
  if (options.length < 2) return;
  polls.unshift({ id: Date.now(), question, options, votedIndex: null, timeAgo: 'just now' });
  document.getElementById('pollQuestion').value = '';
  document.querySelectorAll('#pollOptionInputs .form-input').forEach(i=>i.value='');
  closeModal('pollModal');
  switchTab('polls');
  renderPolls();
}

// ── UTILS ──
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── INIT ──
renderDiscussions();
renderPolls();