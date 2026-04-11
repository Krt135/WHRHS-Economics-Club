import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, push, set, onValue, remove, update, get } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { firebaseConfig } from './app.js';

const app  = initializeApp(firebaseConfig);
const db   = getDatabase(app);
const auth = getAuth(app);

// ─────────────────────────────────────────────
//  AUTH STATE
// ─────────────────────────────────────────────

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
  if (currentId) renderLesson(); else renderList();
});

function getDisplayName(user) {
  if (userProfile && userProfile.displayName) return userProfile.displayName;
  return user.email.split('@')[0];
}

// ─────────────────────────────────────────────
//  CONSTANTS / HELPERS
// ─────────────────────────────────────────────

const ICONS   = { macro:"📊", micro:"🏪", trade:"🌍", money:"💵", markets:"📈", policy:"🏛️" };
const COLOURS = ["#0f1f3d","#1a2e52","#7c3aed","#0369a1","#065f46","#92400e"];
function avColour(name) { let h=0; for(let c of (name||'')) h=(h*31+c.charCodeAt(0))%COLOURS.length; return COLOURS[h]; }
function esc(s) { return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function rel(ts) {
  const s = Math.floor((Date.now()-ts)/1000);
  if(s<60) return "just now"; if(s<3600) return Math.floor(s/60)+" min ago";
  if(s<86400) return Math.floor(s/3600)+" hours ago"; return Math.floor(s/86400)+" days ago";
}
function wdCt(s) { return s.trim() ? s.trim().split(/\s+/).length : 0; }

// Per-user like helpers
function myLiked(l)    { return !!(currentUser && l.userLikes    && l.userLikes[currentUser.uid]); }
function myDisliked(l) { return !!(currentUser && l.userDislikes && l.userDislikes[currentUser.uid]); }

// ─────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────

let lessons     = {};
let currentId   = null;
let topicFilter = "all";
let levelFilter = "all";
let sortMode    = "newest";
let quizState   = {};
let qbQuestions = [];

// ─────────────────────────────────────────────
//  FIREBASE LISTENERS
// ─────────────────────────────────────────────

onValue(ref(db,"lessons"), snapshot => {
  lessons = snapshot.val() || {};
  if (currentId) {
    if (lessons[currentId]) renderLesson();
    else showList();
  } else { renderList(); }
});

// ─────────────────────────────────────────────
//  MODAL HELPERS
// ─────────────────────────────────────────────

function openModal(id)  { document.getElementById(id).classList.add("open"); }
function closeModal(id) { document.getElementById(id).classList.remove("open"); }
document.querySelectorAll(".modal-overlay").forEach(o =>
  o.addEventListener("click", e => { if(e.target===o) o.classList.remove("open"); })
);

// ─────────────────────────────────────────────
//  VIEWS
// ─────────────────────────────────────────────

function showList() {
  currentId=null; quizState={};
  document.getElementById("viewList").classList.add("active");
  document.getElementById("viewLesson").classList.remove("active");
  renderList();
}

function showLesson(firebaseKey) {
  currentId=firebaseKey; quizState={};
  document.getElementById("viewList").classList.remove("active");
  document.getElementById("viewLesson").classList.add("active");
  renderLesson();
}

// ─────────────────────────────────────────────
//  FILTER / SORT
// ─────────────────────────────────────────────

function setTopicFilter(btn, val) {
  topicFilter=val;
  document.querySelectorAll(".filter-chip").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active"); renderList();
}

function setLevelFilter(btn, val) {
  levelFilter=val;
  document.querySelectorAll(".level-chip").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active"); renderList();
}

// ─────────────────────────────────────────────
//  RENDER LIST
// ─────────────────────────────────────────────

function renderList() {
  const q = (document.getElementById("searchInput")?.value||"").toLowerCase();
  let items = Object.entries(lessons).map(([key,val])=>({...val,_key:key}));
  if(topicFilter!=="all") items=items.filter(l=>l.topic===topicFilter);
  if(levelFilter!=="all") items=items.filter(l=>l.level===levelFilter);
  if(q) items=items.filter(l=>l.title.toLowerCase().includes(q)||l.topic.includes(q)||l.level.toLowerCase().includes(q)||(l.desc||"").toLowerCase().includes(q));
  if(sortMode==="oldest")       items.sort((a,b)=>a.postedAt-b.postedAt);
  else if(sortMode==="popular") items.sort((a,b)=>(b.likes||0)-(a.likes||0));
  else                          items.sort((a,b)=>b.postedAt-a.postedAt);

  const el = document.getElementById("lessonsList");
  if(!items.length){
    el.innerHTML=`<div class="empty-state"><div class="empty-italic">Educational lessons coming soon.</div><div class="empty-sub">Exec members will publish simplified economics lessons here.</div></div>`;
    return;
  }
  el.innerHTML = items.map(l=>{
    const iconBg = {Beginner:"#dcfce7",Intermediate:"#fef3c7",Advanced:"#fee2e2"}[l.level]||"#f3f4f6";
    const readMin = Math.max(1,Math.round(wdCt(l.content||"")/130));
    const commentCount = l.comments?Object.keys(l.comments).length:0;
    return `
    <div class="lesson-card" onclick="showLesson('${l._key}')">
      <div class="lc-top">
        <div class="lc-icon" style="background:${iconBg}">${esc(l.icon||ICONS[l.topic]||"📚")}</div>
        <div class="lc-badges">
          <span class="level-badge ${l.level.toLowerCase()}">${esc(l.level)}</span>
          <span class="topic-badge">${esc(l.topic)}</span>
        </div>
      </div>
      <div class="lc-title">${esc(l.title)}</div>
      <div class="lc-desc">${esc(l.desc||"")}</div>
      <div class="lc-footer">
        <div class="lc-meta">
          <span>${rel(l.postedAt)}</span><span>·</span>
          <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          ${commentCount}
        </div>
        <span class="lc-read">~${readMin} min read</span>
      </div>
      ${l.author?`<div class="lc-author" style="font-size:12px;color:var(--text-muted);margin-top:6px">By ${esc(l.author)}</div>`:''}
    </div>`;
  }).join("");
}

// ─────────────────────────────────────────────
//  RENDER LESSON
// ─────────────────────────────────────────────

function renderLesson() {
  const l = lessons[currentId]; if(!l) return showList();
  const readMin = Math.max(1,Math.round(wdCt(l.content||"")/130));
  const iLiked    = myLiked(l);
  const iDisliked = myDisliked(l);

  function parseContent(raw) {
    return (raw||"").split(/\n\n+/).map(para=>{
      para=para.trim();
      if(para.startsWith("===")){const h=para.replace(/^===\s*/,"").replace(/\s*===$/,"");return`<h3>${esc(h)}</h3>`;}
      if(para.startsWith("[EXAMPLE]")){const inner=para.replace("[EXAMPLE]","").replace("[/EXAMPLE]","").trim();return`<div class="example-box"><strong>EXAMPLE</strong>${esc(inner)}</div>`;}
      return`<p>${esc(para)}</p>`;
    }).join("");
  }

  // Quiz HTML
  const qs = Array.isArray(l.quiz)?l.quiz:[];
  let quizHtml="";
  if(qs.length){
    const qi=quizState.qi||0, score=quizState.score||0, done=quizState.done||false;
    if(done){
      const pct=Math.round(score/qs.length*100);
      const icon=pct===100?"🏆":pct>=70?"🎯":"📚";
      quizHtml=`<div class="quiz-section"><div class="quiz-header">✅ COMPREHENSION CHECK</div><div class="quiz-body"><div class="quiz-done">
        <div class="quiz-done-icon">${icon}</div>
        <div class="quiz-done-title">${pct===100?"Perfect!":pct>=70?"Well done!":"Keep studying!"}</div>
        <div class="quiz-done-score">${score} / ${qs.length} correct · ${pct}%</div>
        <button class="quiz-retry" onclick="quizState={};renderLesson()">Try Again</button>
      </div></div></div>`;
    } else {
      const q=qs[qi], answered=quizState.answered||false, chosen=quizState.chosen;
      quizHtml=`<div class="quiz-section">
        <div class="quiz-header" style="justify-content:space-between">
          <span>📝 COMPREHENSION CHECK</span><span class="quiz-score">Q${qi+1} of ${qs.length} · ${score} correct</span>
        </div>
        <div class="quiz-body">
          <div class="quiz-q">${esc(q.q)}</div>
          <div class="quiz-options">
            ${(q.opts||[]).map((o,i)=>{let cls="quiz-opt";if(answered)cls+=i===q.correct?" correct":i===chosen?" wrong":" dimmed";return`<button class="${cls}" ${answered?"disabled":""} onclick="answerQuiz(${i})">${esc(o)}</button>`;}).join("")}
          </div>
          <div class="quiz-feedback ${answered?"visible":""}">
            <strong>${answered&&chosen===q.correct?"✓ Correct! ":"✗ Not quite. "}</strong>
            ${answered?esc(q.exp||""):""}
          </div>
          <button class="quiz-next ${answered?"visible":""}" onclick="nextQuiz()">
            ${qi+1<qs.length?"Next Question →":"See Results →"}
          </button>
        </div>
      </div>`;
    }
  }

  // Comments
  const commentEntries = l.comments
    ? Object.entries(l.comments).map(([k,v])=>({...v,_key:k})).sort((a,b)=>a.postedAt-b.postedAt)
    : [];

  // Only author or admin sees Edit/Delete
  const canModify = currentUser && (l.authorId === currentUser.uid || userRole === 'admin');

  const commentsHtml = commentEntries.length
    ? commentEntries.map(c=>{
        const canDeleteComment = currentUser && (c.authorId === currentUser.uid || userRole === 'admin');
        return `
        <div class="comment-item">
          <div class="comment-av" style="background:${avColour(c.author)}">${esc(c.initials||'?')}</div>
          <div class="comment-bubble">
            <div class="comment-hdr">
              <span class="comment-author">${esc(c.author)}</span>
              <span class="comment-time">${rel(c.postedAt)}</span>
            </div>
            <div class="comment-text">${esc(c.text)}</div>
            <div class="comment-acts">
              <button class="cmt-act ${c.liked?"liked":""}" onclick="likeComment('${currentId}','${c._key}',${!!c.liked},${c.likes||0})">
                <svg width="12" height="12" fill="${c.liked?"currentColor":"none"}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/></svg>
                ${c.likes||0}
              </button>
              ${canDeleteComment?`
              <button class="cmt-act cmt-del" onclick="deleteComment('${currentId}','${c._key}')">
                <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                Delete
              </button>`:''}
            </div>
          </div>
        </div>`;
      }).join("")
    : `<p style="font-style:italic;color:#9ca3af;font-size:15px">No comments yet — ask a question or leave a thought!</p>`;

  document.getElementById("lessonTopActions").innerHTML = canModify ? `
    <button class="topbar-btn btn-edit-tb" onclick="openEditModal()">✏️ Edit</button>
    <button class="topbar-btn btn-del-tb"  onclick="openModal('confirmModal')">🗑️ Delete</button>` : "";

  const concepts = Array.isArray(l.concepts)?l.concepts:[];

  document.getElementById("lessonBody").innerHTML = `
    <div class="lesson-eyebrow">THE ACADEMY · ${esc(l.topic.toUpperCase())} · <span class="level-badge ${l.level.toLowerCase()}">${esc(l.level)}</span></div>
    <div class="lesson-hero-icon">${esc(l.icon||ICONS[l.topic]||"📚")}</div>
    <div class="lesson-title">${esc(l.title)}</div>
    <div class="lesson-meta-row">
      ${l.author?`<span style="font-size:13px;color:var(--text-muted)">By <strong>${esc(l.author)}</strong></span><span style="font-size:13px;color:var(--text-muted)">·</span>`:''}
      <span style="font-size:13px;color:var(--text-muted)">${rel(l.postedAt)}</span>
      <span style="font-size:13px;color:var(--text-muted)">·</span>
      <span style="font-size:13px;color:var(--text-muted)">~${readMin} min read</span>
      <span style="font-size:13px;color:var(--text-muted)">·</span>
      <span style="font-size:13px;color:var(--text-muted)">${commentEntries.length} comment${commentEntries.length!==1?"s":""}</span>
    </div>
    ${concepts.length?`<div class="key-concepts"><div class="kc-title">KEY CONCEPTS IN THIS LESSON</div><ul class="kc-list">${concepts.map(c=>`<li>${esc(c)}</li>`).join("")}</ul></div>`:""}
    <div class="lesson-divider"></div>
    <div class="lesson-content">${parseContent(l.content)}</div>
    ${quizHtml}
    <div class="lesson-reaction">
      <button class="react-btn ${iLiked?"liked":""}" onclick="reactLesson('like')">
        👍 Helpful (${l.likes||0})
      </button>
      <button class="react-btn ${iDisliked?"disliked":""}" onclick="reactLesson('dislike')">
        👎 Not Helpful (${l.dislikes||0})
      </button>
    </div>
    <div class="comments-area">
      <div class="comments-title">💬 ${commentEntries.length} Comment${commentEntries.length!==1?"s":""}</div>
      ${commentsHtml}
      <div class="new-comment-box" style="margin-top:16px">
        <textarea class="new-comment-input" id="cmtInput" placeholder="Ask a question or leave a comment..."></textarea>
        <button class="btn-post-cmt" onclick="postComment()">Post</button>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────
//  PUBLISH LESSON
// ─────────────────────────────────────────────

async function publishLesson() {
  if (!currentUser) return alert("Please log in to post.");
  const title   = document.getElementById("cTitle").value.trim();
  const content = document.getElementById("cContent").value.trim();
  if(!title){document.getElementById("cTitle").focus();return;}
  if(!content){document.getElementById("cContent").focus();return;}
  const name     = getDisplayName(currentUser);
  const initials = name.substring(0,2).toUpperCase();
  const concepts  = document.getElementById("cConcepts").value.split("\n").map(s=>s.trim()).filter(Boolean);
  const validQuiz = qbQuestions.filter(q=>q.q&&q.opts.filter(Boolean).length>=2);
  const newRef = push(ref(db,"lessons"));
  await set(newRef,{
    icon:     document.getElementById("cIcon").value.trim()||ICONS[document.getElementById("cTopic").value]||"📚",
    title, topic: document.getElementById("cTopic").value, level: document.getElementById("cLevel").value,
    desc:     document.getElementById("cDesc").value.trim()||title,
    concepts, content, quiz: validQuiz,
    author: name, authorInitials: initials, authorId: currentUser.uid,
    postedAt: Date.now(), likes: 0, dislikes: 0
  });
  ["cTitle","cDesc","cContent","cIcon","cConcepts"].forEach(id=>document.getElementById(id).value="");
  document.getElementById("cWC").textContent="0 words";
  qbQuestions=[]; renderQuizBuilder(); closeModal("createModal");
}

// ─────────────────────────────────────────────
//  EDIT / DELETE LESSON
// ─────────────────────────────────────────────

function openEditModal() {
  const l=lessons[currentId]; if(!l) return;
  document.getElementById("eTitle").value    = l.title;
  document.getElementById("eTopic").value    = l.topic;
  document.getElementById("eLevel").value    = l.level;
  document.getElementById("eIcon").value     = l.icon||"";
  document.getElementById("eDesc").value     = l.desc||"";
  document.getElementById("eConcepts").value = (Array.isArray(l.concepts)?l.concepts:[]).join("\n");
  document.getElementById("eContent").value  = l.content||"";
  document.getElementById("eWC").textContent = wdCt(l.content||"")+" words";
  openModal("editModal");
}

async function saveEdit() {
  const l=lessons[currentId]; if(!l) return;
  const concepts=document.getElementById("eConcepts").value.split("\n").map(s=>s.trim()).filter(Boolean);
  await update(ref(db,`lessons/${currentId}`),{
    title:   document.getElementById("eTitle").value.trim()||l.title,
    topic:   document.getElementById("eTopic").value,
    level:   document.getElementById("eLevel").value,
    icon:    document.getElementById("eIcon").value.trim()||ICONS[document.getElementById("eTopic").value]||"📚",
    desc:    document.getElementById("eDesc").value.trim()||l.desc,
    concepts, content: document.getElementById("eContent").value.trim()||l.content,
  });
  closeModal("editModal");
}

async function deleteLesson() {
  await remove(ref(db,`lessons/${currentId}`));
  closeModal("confirmModal"); showList();
}

// ─────────────────────────────────────────────
//  REACTIONS  (per-user)
// ─────────────────────────────────────────────

async function reactLesson(type) {
  if (!currentUser) return alert("Please log in to react.");
  const l = lessons[currentId]; if(!l) return;
  const uid = currentUser.uid;
  const wasLiked    = !!(l.userLikes    && l.userLikes[uid]);
  const wasDisliked = !!(l.userDislikes && l.userDislikes[uid]);
  let likes    = l.likes    || 0;
  let dislikes = l.dislikes || 0;
  const updates = {};

  if (type==="like") {
    if (wasLiked) { updates[`lessons/${currentId}/userLikes/${uid}`]=null; likes--; }
    else {
      updates[`lessons/${currentId}/userLikes/${uid}`]=true; likes++;
      if (wasDisliked) { updates[`lessons/${currentId}/userDislikes/${uid}`]=null; dislikes--; }
    }
  } else {
    if (wasDisliked) { updates[`lessons/${currentId}/userDislikes/${uid}`]=null; dislikes--; }
    else {
      updates[`lessons/${currentId}/userDislikes/${uid}`]=true; dislikes++;
      if (wasLiked) { updates[`lessons/${currentId}/userLikes/${uid}`]=null; likes--; }
    }
  }
  updates[`lessons/${currentId}/likes`]    = likes;
  updates[`lessons/${currentId}/dislikes`] = dislikes;
  await update(ref(db), updates);
}

// ─────────────────────────────────────────────
//  COMMENTS
// ─────────────────────────────────────────────

async function postComment() {
  if (!currentUser) return alert("Please log in to comment.");
  const inp=document.getElementById("cmtInput");
  if(!inp||!inp.value.trim()) return;
  const name=getDisplayName(currentUser);
  const cmtRef=push(ref(db,`lessons/${currentId}/comments`));
  await set(cmtRef,{
    author: name, initials: name.substring(0,2).toUpperCase(),
    authorId: currentUser.uid, text: inp.value.trim(),
    postedAt: Date.now(), likes: 0, liked: false
  });
  inp.value="";
}

async function likeComment(lessonKey, commentKey, currentlyLiked, currentLikes) {
  const newLiked=!currentlyLiked;
  await update(ref(db,`lessons/${lessonKey}/comments/${commentKey}`),{
    liked: newLiked, likes: newLiked?currentLikes+1:currentLikes-1
  });
}

async function deleteComment(lessonKey, commentKey) {
  if(confirm("Delete this comment?")) await remove(ref(db,`lessons/${lessonKey}/comments/${commentKey}`));
}

// ─────────────────────────────────────────────
//  QUIZ
// ─────────────────────────────────────────────

function answerQuiz(i) {
  const l=lessons[currentId]; if(!l) return;
  const q=(l.quiz||[])[quizState.qi||0];
  if(quizState.answered) return;
  quizState.answered=true; quizState.chosen=i;
  if(i===q.correct) quizState.score=(quizState.score||0)+1;
  renderLesson();
}

function nextQuiz() {
  const l=lessons[currentId]; if(!l) return;
  const qi=(quizState.qi||0)+1;
  if(qi>=(l.quiz||[]).length){quizState.done=true;}
  else{quizState.qi=qi;quizState.answered=false;quizState.chosen=undefined;}
  renderLesson();
}

// ─────────────────────────────────────────────
//  QUIZ BUILDER
// ─────────────────────────────────────────────

function addQuizQuestion() { qbQuestions.push({q:"",opts:["","","",""],correct:0,exp:""}); renderQuizBuilder(); }

function renderQuizBuilder() {
  const el=document.getElementById("quizBuilder");
  el.innerHTML=qbQuestions.map((qq,qi)=>`
    <div class="qb-question">
      <div class="qb-q-label">Question ${qi+1}</div>
      <input class="form-input" style="margin-bottom:8px;font-size:14px" placeholder="Question text..." value="${esc(qq.q)}" oninput="qbQuestions[${qi}].q=this.value">
      <div class="qb-opts">
        ${qq.opts.map((o,oi)=>`
          <div class="qb-opt-row">
            <input class="qb-opt-input" placeholder="Option ${oi+1}" value="${esc(o)}" oninput="qbQuestions[${qi}].opts[${oi}]=this.value">
            <input type="radio" class="qb-correct-radio" name="correct_${qi}" ${qq.correct===oi?"checked":""} onchange="qbQuestions[${qi}].correct=${oi}" title="Mark as correct">
            <span class="qb-correct-label">✓ correct</span>
          </div>`).join("")}
      </div>
      <input class="form-input" style="margin-top:8px;font-size:13px" placeholder="Explanation (shown after answering)..." value="${esc(qq.exp)}" oninput="qbQuestions[${qi}].exp=this.value">
    </div>`).join("");
}

// ─────────────────────────────────────────────
//  WORD COUNT / ANNOUNCEMENT
// ─────────────────────────────────────────────

function updateWC()  { document.getElementById("cWC").textContent = wdCt(document.getElementById("cContent").value)+" words"; }
function updateEWC() { document.getElementById("eWC").textContent = wdCt(document.getElementById("eContent").value)+" words"; }

function postAnnounce() {
  const v=document.getElementById("announceInput").value.trim(); if(!v) return;
  document.getElementById("announceText").textContent=v;
  document.getElementById("announceInput").value="";
  closeModal("announceModal");
}

// ─────────────────────────────────────────────
//  EXPOSE TO HTML
// ─────────────────────────────────────────────

Object.assign(window,{
  showList, showLesson, openModal, closeModal,
  setTopicFilter, setLevelFilter,
  publishLesson, openEditModal, saveEdit, deleteLesson,
  reactLesson, postComment, likeComment, deleteComment,
  answerQuiz, nextQuiz, addQuizQuestion, renderQuizBuilder,
  updateWC, updateEWC, postAnnounce,
});

window.setSortMode = (val) => { sortMode=val; renderList(); };