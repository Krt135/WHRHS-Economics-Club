// ── DATA ──
const ICONS = { macro:'📊', micro:'🏪', trade:'🌍', money:'💵', markets:'📈', policy:'🏛️' };
const COLOURS = ['#0f1f3d','#1a2e52','#7c3aed','#0369a1','#065f46','#92400e'];
function avColour(name){let h=0;for(let c of name)h=(h*31+c.charCodeAt(0))%COLOURS.length;return COLOURS[h];}

let lessons = [
  {
    id:1, icon:'💵', title:'What is Inflation?', topic:'macro', level:'Beginner',
    desc:'Understand why prices rise over time and what it means for your wallet.',
    concepts:['Price levels','Purchasing power','CPI','Causes of inflation'],
    content:`Inflation is one of the most important concepts in economics — and it affects everyone, every day.

=== What Does Inflation Mean? ===

Simply put, inflation is when prices go up over time. If a chocolate bar costs $1 today and $1.10 next year, that 10% increase is inflation. The money in your pocket buys a little less than it used to.

[EXAMPLE] Imagine your grandparents paid 25 cents for a movie ticket in 1970. That same ticket today might cost $15. That's decades of inflation at work. [/EXAMPLE]

=== Why Does Inflation Happen? ===

Inflation has several main causes:

1. Too much money in the economy — when governments print a lot of money, there's more of it chasing the same number of goods, so prices rise.

2. High demand — when everyone wants something and there isn't enough of it, sellers can charge more. This is called demand-pull inflation.

3. Rising costs — if it costs more to make things (like oil becoming more expensive), companies pass those costs on to you. This is cost-push inflation.

=== How Do We Measure It? ===

Economists use a tool called the Consumer Price Index (CPI). They track the prices of a "basket" of everyday goods — groceries, gas, rent, clothing — over time. If that basket costs more this year than last year, inflation has occurred.

[EXAMPLE] If last year's basket cost $500 and this year it costs $515, inflation is 3% (15 ÷ 500 × 100). [/EXAMPLE]

=== Is Inflation Always Bad? ===

Not necessarily! A small amount of inflation — around 2% — is actually healthy for an economy. It encourages people to spend money now rather than hoard it, which keeps businesses running and workers employed.

The problem comes when inflation is too high (making it hard to afford basic needs) or too unpredictable (making it hard for businesses to plan). That's why central banks like the Federal Reserve work to keep inflation stable.`,
    quiz:[
      {q:'What does inflation mean?',opts:['Prices going down','Prices going up over time','The economy growing fast','Taxes increasing'],correct:1,exp:'Inflation refers to a general rise in prices over time, meaning your money buys less than it used to.'},
      {q:'What is the CPI used for?',opts:['Measuring unemployment','Tracking stock prices','Measuring changes in the price level','Calculating tax rates'],correct:2,exp:'The Consumer Price Index (CPI) tracks the prices of a basket of everyday goods to measure inflation.'},
      {q:'What level of annual inflation is generally considered healthy?',opts:['0%','Around 2%','10%','25%'],correct:1,exp:'Central banks typically target around 2% annual inflation — enough to keep the economy active without eroding purchasing power.'}
    ],
    postedAt:new Date(Date.now()-2*86400000), likes:8, dislikes:0, liked:false, disliked:false,
    comments:[{id:1,author:'Aryan Shah',initials:'AS',text:'This is super clear! Finally understand the difference between demand-pull and cost-push.',postedAt:new Date(Date.now()-86400000),likes:2,liked:false}]
  },
  {
    id:2, icon:'⚖️', title:'Supply and Demand: The Basics', topic:'micro', level:'Beginner',
    desc:'The foundation of economics — learn how prices are set in a free market.',
    concepts:['Supply curve','Demand curve','Equilibrium price','Market forces'],
    content:`Supply and demand is the most fundamental concept in all of economics. Understanding it explains why concert tickets are expensive, why gas prices go up in summer, and why stores have sales.

=== What is Demand? ===

Demand is how much of something people want to buy at a given price. Generally, when prices go up, people want less of something. When prices go down, people want more.

[EXAMPLE] If pizza costs $5, you might buy it twice a week. If it costs $20, you might only buy it once a month. Your demand went down when the price went up. [/EXAMPLE]

=== What is Supply? ===

Supply is how much of something producers are willing to sell at a given price. Generally, higher prices motivate sellers to produce more — because they make more profit.

[EXAMPLE] If coffee beans sell for $2/kg, a farmer might grow 100kg. If the price rises to $5/kg, that same farmer might grow 300kg because it's more profitable. [/EXAMPLE]

=== Where They Meet: Equilibrium ===

The equilibrium price is where supply and demand balance — where the amount producers want to sell equals the amount consumers want to buy. This is how free markets naturally set prices.

When something disrupts equilibrium — like a bad harvest reducing supply, or a new trend increasing demand — prices shift until a new equilibrium is found.

=== Real World Examples ===

Hand sanitizer during COVID-19: demand skyrocketed, supply couldn't keep up, prices rose sharply. Over time, manufacturers increased production and prices came back down.

Electric vehicles: as battery technology improves and production scales up, supply increases. Combined with government incentives boosting demand, the market is finding a new equilibrium at lower prices than a decade ago.`,
    quiz:[
      {q:'What happens to demand when prices go up?',opts:['Demand increases','Demand decreases','Demand stays the same','Supply increases'],correct:1,exp:'The law of demand states that as price rises, quantity demanded falls — people buy less of something when it costs more.'},
      {q:'What is the equilibrium price?',opts:['The lowest possible price','The price set by the government','The price where supply equals demand','The average of all prices'],correct:2,exp:'Equilibrium is where the quantity supplied matches the quantity demanded — the market "clears" at this price.'}
    ],
    postedAt:new Date(Date.now()-5*86400000), likes:12, dislikes:1, liked:false, disliked:false,
    comments:[]
  }
];

let currentId = null;
let topicFilter = 'all';
let levelFilter = 'all';
let sortMode = 'newest';
let quizState = {};

// ── UTILS ──
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function rel(d){const s=Math.floor((Date.now()-d)/1000);if(s<60)return'just now';if(s<3600)return Math.floor(s/60)+' min ago';if(s<86400)return Math.floor(s/3600)+' hours ago';return Math.floor(s/86400)+' days ago';}
function wdCt(s){return s.trim()?s.trim().split(/\s+/).length:0;}
function updateWC(){document.getElementById('cWC').textContent=wdCt(document.getElementById('cContent').value)+' words';}
function updateEWC(){document.getElementById('eWC').textContent=wdCt(document.getElementById('eContent').value)+' words';}

// ── MODALS ──
function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){document.getElementById(id).classList.remove('open');}
document.querySelectorAll('.modal-overlay').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('open');}));

// ── VIEWS ──
function showList(){document.getElementById('viewList').classList.add('active');document.getElementById('viewLesson').classList.remove('active');currentId=null;renderList();}
function showLesson(id){currentId=id;document.getElementById('viewList').classList.remove('active');document.getElementById('viewLesson').classList.add('active');quizState={};renderLesson();}

// ── FILTER ──
function setTopicFilter(btn,val){topicFilter=val;document.querySelectorAll('.filter-chip').forEach(b=>b.classList.remove('active'));btn.classList.add('active');renderList();}
function setLevelFilter(btn,val){levelFilter=val;document.querySelectorAll('.level-chip').forEach(b=>b.classList.remove('active'));btn.classList.add('active');renderList();}

// ── RENDER LIST ──
function renderList(){
  const q=document.getElementById('searchInput').value.toLowerCase();
  let items=[...lessons];
  if(topicFilter!=='all')items=items.filter(l=>l.topic===topicFilter);
  if(levelFilter!=='all')items=items.filter(l=>l.level===levelFilter);
  if(q)items=items.filter(l=>l.title.toLowerCase().includes(q)||l.topic.includes(q)||l.level.toLowerCase().includes(q)||l.desc.toLowerCase().includes(q));
  if(sortMode==='oldest')items.sort((a,b)=>a.postedAt-b.postedAt);
  else if(sortMode==='popular')items.sort((a,b)=>b.likes-a.likes);
  else items.sort((a,b)=>b.postedAt-a.postedAt);

  const el=document.getElementById('lessonsList');
  if(!items.length){
    el.innerHTML=`<div class="empty-state"><div class="empty-italic">Educational lessons coming soon.</div><div class="empty-sub">Exec members will publish simplified economics lessons here.</div></div>`;
    return;
  }
  el.innerHTML=items.map(l=>{
    const iconBg={Beginner:'#dcfce7',Intermediate:'#fef3c7',Advanced:'#fee2e2'}[l.level];
    const readMin=Math.max(1,Math.round(wdCt(l.content)/130));
    return`<div class="lesson-card" onclick="showLesson(${l.id})">
      <div class="lc-top">
        <div class="lc-icon" style="background:${iconBg}">${l.icon||ICONS[l.topic]||'📚'}</div>
        <div class="lc-badges">
          <span class="level-badge ${l.level.toLowerCase()}">${l.level}</span>
          <span class="topic-badge">${l.topic}</span>
        </div>
      </div>
      <div class="lc-title">${esc(l.title)}</div>
      <div class="lc-desc">${esc(l.desc)}</div>
      <div class="lc-footer">
        <div class="lc-meta">
          <span>${rel(l.postedAt)}</span>
          <span>·</span>
          <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          ${l.comments.length}
        </div>
        <span class="lc-read">~${readMin} min read</span>
      </div>
    </div>`;
  }).join('');
}

// ── RENDER LESSON ──
function renderLesson(){
  const l=lessons.find(x=>x.id===currentId); if(!l)return showList();
  const readMin=Math.max(1,Math.round(wdCt(l.content)/130));

  // Render content with === headings === and [EXAMPLE] boxes
  function parseContent(raw){
    return raw.split(/\n\n+/).map(para=>{
      para=para.trim();
      if(para.startsWith('===')){
        const heading=para.replace(/^===\s*/,'').replace(/\s*===$/,'');
        return`<h3>${esc(heading)}</h3>`;
      }
      if(para.startsWith('[EXAMPLE]')){
        const inner=para.replace('[EXAMPLE]','').replace('[/EXAMPLE]','').trim();
        return`<div class="example-box"><strong>EXAMPLE</strong>${esc(inner)}</div>`;
      }
      return`<p>${esc(para)}</p>`;
    }).join('');
  }

  // Quiz HTML
  const qs=l.quiz||[];
  let quizHtml='';
  if(qs.length){
    const qi=quizState.qi||0;
    const score=quizState.score||0;
    const done=quizState.done||false;
    if(done){
      const pct=Math.round(score/qs.length*100);
      let icon=pct===100?'🏆':pct>=70?'🎯':'📚';
      quizHtml=`<div class="quiz-section">
        <div class="quiz-header"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>&nbsp;COMPREHENSION CHECK</div>
        <div class="quiz-body"><div class="quiz-done">
          <div class="quiz-done-icon">${icon}</div>
          <div class="quiz-done-title">${pct===100?'Perfect!':pct>=70?'Well done!':'Keep studying!'}</div>
          <div class="quiz-done-score">${score} / ${qs.length} correct · ${pct}%</div>
          <button class="quiz-retry" onclick="quizState={};renderLesson()">Try Again</button>
        </div></div>
      </div>`;
    } else {
      const q=qs[qi];
      const answered=quizState.answered||false;
      const chosen=quizState.chosen;
      quizHtml=`<div class="quiz-section">
        <div class="quiz-header" style="justify-content:space-between">
          <span><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>&nbsp;COMPREHENSION CHECK</span>
          <span class="quiz-score">Q${qi+1} of ${qs.length} · ${score} correct</span>
        </div>
        <div class="quiz-body">
          <div class="quiz-q">${esc(q.q)}</div>
          <div class="quiz-options">
            ${q.opts.map((o,i)=>{
              let cls='quiz-opt';
              if(answered){cls+= i===q.correct?' correct': i===chosen?' wrong':' dimmed';}
              return`<button class="${cls}" ${answered?'disabled':''} onclick="answerQuiz(${i})">${esc(o)}</button>`;
            }).join('')}
          </div>
          <div class="quiz-feedback ${answered?'visible':''}"><strong>${answered&&chosen===q.correct?'✓ Correct! ':'✗ Not quite. '}</strong>${answered?esc(q.exp):''}</div>
          <button class="quiz-next ${answered?'visible':''}" onclick="nextQuiz()">${qi+1<qs.length?'Next Question →':'See Results →'}</button>
        </div>
      </div>`;
    }
  }

  // Comments
  const commentsHtml=l.comments.length
    ?l.comments.map(c=>`<div class="comment-item">
        <div class="comment-av" style="background:${avColour(c.author)}">${c.initials}</div>
        <div class="comment-bubble">
          <div class="comment-hdr"><span class="comment-author">${esc(c.author)}</span><span class="comment-time">${rel(c.postedAt)}</span></div>
          <div class="comment-text">${esc(c.text)}</div>
          <div class="comment-acts">
            <button class="cmt-act ${c.liked?'liked':''}" onclick="likeComment(${l.id},${c.id})">
              <svg width="12" height="12" fill="${c.liked?'currentColor':'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/></svg>${c.likes}
            </button>
            <button class="cmt-act cmt-del" onclick="deleteCmt(${l.id},${c.id})">
              <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>Delete
            </button>
          </div>
        </div>
      </div>`).join('')
    :'<p style="font-style:italic;color:#9ca3af;font-size:15px">No comments yet — ask a question or share a thought!</p>';

  document.getElementById('lessonTopActions').innerHTML=`
    <button class="topbar-btn btn-edit-tb" onclick="openEditModal()">
      <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Edit
    </button>
    <button class="topbar-btn btn-del-tb" onclick="openModal('confirmModal')">
      <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>Delete
    </button>`;

  document.getElementById('lessonBody').innerHTML=`
    <div class="lesson-eyebrow">THE ACADEMY · ${l.topic.toUpperCase()} · <span class="level-badge ${l.level.toLowerCase()}" style="padding:2px 8px">${l.level}</span></div>
    <div class="lesson-hero-icon">${l.icon||ICONS[l.topic]||'📚'}</div>
    <div class="lesson-title">${esc(l.title)}</div>
    <div class="lesson-meta-row">
      <span style="font-size:13px;color:var(--text-muted)">${rel(l.postedAt)}</span>
      <span style="font-size:13px;color:var(--text-muted)">·</span>
      <span style="font-size:13px;color:var(--text-muted)">~${readMin} min read</span>
      <span style="font-size:13px;color:var(--text-muted)">·</span>
      <span style="font-size:13px;color:var(--text-muted)">${l.comments.length} comment${l.comments.length!==1?'s':''}</span>
    </div>
    ${l.concepts&&l.concepts.length?`
    <div class="key-concepts">
      <div class="kc-title">KEY CONCEPTS IN THIS LESSON</div>
      <ul class="kc-list">${l.concepts.map(c=>`<li>${esc(c)}</li>`).join('')}</ul>
    </div>`:''}
    <div class="lesson-divider"></div>
    <div class="lesson-content">${parseContent(l.content)}</div>
    ${quizHtml}
    <div class="lesson-reaction">
      <button class="react-btn ${l.liked?'liked':''}" onclick="react(${l.id},'like');renderLesson()">
        <svg width="15" height="15" fill="${l.liked?'currentColor':'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>
        Helpful (${l.likes})
      </button>
      <button class="react-btn ${l.disliked?'disliked':''}" onclick="react(${l.id},'dislike');renderLesson()">
        <svg width="15" height="15" fill="${l.disliked?'currentColor':'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"/></svg>
        Not Helpful (${l.dislikes})
      </button>
    </div>
    <div class="comments-area">
      <div class="comments-title"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>${l.comments.length} Comment${l.comments.length!==1?'s':''}</div>
      ${commentsHtml}
      <div class="new-comment-box" style="margin-top:16px">
        <textarea class="new-comment-input" id="cmtInput" placeholder="Ask a question or leave a comment..."></textarea>
        <button class="btn-post-cmt" onclick="postCmt(${l.id})">Post</button>
      </div>
    </div>`;
}

// ── QUIZ ──
function answerQuiz(i){
  const l=lessons.find(x=>x.id===currentId); if(!l) return;
  const q=(l.quiz||[])[quizState.qi||0];
  if(quizState.answered) return;
  quizState.answered=true;
  quizState.chosen=i;
  if(i===q.correct) quizState.score=(quizState.score||0)+1;
  renderLesson();
}
function nextQuiz(){
  const l=lessons.find(x=>x.id===currentId); if(!l) return;
  const qi=(quizState.qi||0)+1;
  if(qi>=l.quiz.length){quizState.done=true;}
  else{quizState.qi=qi;quizState.answered=false;quizState.chosen=undefined;}
  renderLesson();
}

// ── REACTIONS / COMMENTS ──
function react(id,type){
  const l=lessons.find(x=>x.id===id); if(!l)return;
  if(type==='like'){if(l.liked){l.liked=false;l.likes--;}else{l.liked=true;l.likes++;if(l.disliked){l.disliked=false;l.dislikes--;}}}
  else{if(l.disliked){l.disliked=false;l.dislikes--;}else{l.disliked=true;l.dislikes++;if(l.liked){l.liked=false;l.likes--;}}}
  if(currentId===id)renderLesson();else renderList();
}
function postCmt(lid){
  const l=lessons.find(x=>x.id===lid);
  const inp=document.getElementById('cmtInput');
  if(!l||!inp||!inp.value.trim())return;
  l.comments.push({id:Date.now(),author:'Kartikeya Pant',initials:'KP',text:inp.value.trim(),postedAt:new Date(),likes:0,liked:false});
  renderLesson();
}
function likeComment(lid,cid){const l=lessons.find(x=>x.id===lid);if(!l)return;const c=l.comments.find(x=>x.id===cid);if(!c)return;c.liked=!c.liked;c.likes+=c.liked?1:-1;renderLesson();}
function deleteCmt(lid,cid){const l=lessons.find(x=>x.id===lid);if(!l)return;l.comments=l.comments.filter(c=>c.id!==cid);renderLesson();}

// ── QUIZ BUILDER (in modal) ──
let qbQuestions=[];
function addQuizQuestion(){
  qbQuestions.push({q:'',opts:['','','',''],correct:0,exp:''});
  renderQuizBuilder();
}
function renderQuizBuilder(){
  const el=document.getElementById('quizBuilder');
  el.innerHTML=qbQuestions.map((qq,qi)=>`
    <div class="qb-question">
      <div class="qb-q-label">Question ${qi+1}</div>
      <input class="form-input" style="margin-bottom:8px;font-size:14px" placeholder="Question text..." value="${esc(qq.q)}" oninput="qbQuestions[${qi}].q=this.value">
      <div class="qb-opts">${qq.opts.map((o,oi)=>`
        <div class="qb-opt-row">
          <input class="qb-opt-input" placeholder="Option ${oi+1}" value="${esc(o)}" oninput="qbQuestions[${qi}].opts[${oi}]=this.value">
          <input type="radio" class="qb-correct-radio" name="correct_${qi}" ${qq.correct===oi?'checked':''} onchange="qbQuestions[${qi}].correct=${oi}" title="Mark as correct">
          <span class="qb-correct-label">✓ correct</span>
        </div>`).join('')}
      </div>
      <input class="form-input" style="margin-top:8px;font-size:13px" placeholder="Explanation (shown after answering)..." value="${esc(qq.exp)}" oninput="qbQuestions[${qi}].exp=this.value">
    </div>`).join('');
}

// ── PUBLISH LESSON ──
function publishLesson(){
  const title=document.getElementById('cTitle').value.trim();
  const content=document.getElementById('cContent').value.trim();
  if(!title||!content){if(!title)document.getElementById('cTitle').focus();else document.getElementById('cContent').focus();return;}
  const concepts=document.getElementById('cConcepts').value.split('\n').map(s=>s.trim()).filter(Boolean);
  lessons.unshift({
    id:Date.now(),
    icon:document.getElementById('cIcon').value.trim()||ICONS[document.getElementById('cTopic').value]||'📚',
    title,
    topic:document.getElementById('cTopic').value,
    level:document.getElementById('cLevel').value,
    desc:document.getElementById('cDesc').value.trim()||title,
    concepts,content,
    quiz:qbQuestions.filter(q=>q.q&&q.opts.filter(Boolean).length>=2),
    postedAt:new Date(),likes:0,dislikes:0,liked:false,disliked:false,comments:[]
  });
  ['cTitle','cDesc','cContent','cIcon','cConcepts'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('cWC').textContent='0 words';
  qbQuestions=[];renderQuizBuilder();
  closeModal('createModal');renderList();
}

// ── EDIT ──
function openEditModal(){
  const l=lessons.find(x=>x.id===currentId);if(!l)return;
  document.getElementById('eTitle').value=l.title;
  document.getElementById('eTopic').value=l.topic;
  document.getElementById('eLevel').value=l.level;
  document.getElementById('eIcon').value=l.icon||'';
  document.getElementById('eDesc').value=l.desc;
  document.getElementById('eConcepts').value=(l.concepts||[]).join('\n');
  document.getElementById('eContent').value=l.content;
  document.getElementById('eWC').textContent=wdCt(l.content)+' words';
  openModal('editModal');
}
function saveEdit(){
  const l=lessons.find(x=>x.id===currentId);if(!l)return;
  l.title=document.getElementById('eTitle').value.trim()||l.title;
  l.topic=document.getElementById('eTopic').value;
  l.level=document.getElementById('eLevel').value;
  l.icon=document.getElementById('eIcon').value.trim()||ICONS[l.topic]||'📚';
  l.desc=document.getElementById('eDesc').value.trim()||l.desc;
  l.concepts=document.getElementById('eConcepts').value.split('\n').map(s=>s.trim()).filter(Boolean);
  l.content=document.getElementById('eContent').value.trim()||l.content;
  closeModal('editModal');renderLesson();
}

// ── DELETE ──
function deleteLesson(){lessons=lessons.filter(x=>x.id!==currentId);closeModal('confirmModal');showList();}

// ── ANNOUNCE ──
function postAnnounce(){
  const v=document.getElementById('announceInput').value.trim();if(!v)return;
  document.getElementById('announceText').textContent=v;
  document.getElementById('announceInput').value='';
  closeModal('announceModal');
}

renderList();