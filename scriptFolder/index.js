import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, query, orderByChild, limitToLast, onValue } 
  from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";
import { firebaseConfig } from './app.js'; // Make sure this path is correct!

// 1. You MUST do this first on every page
const app = initializeApp(firebaseConfig);

// 2. NOW you can get the database
const db = getDatabase(app);

// 3. Now your logic will work without the "No Firebase App" error
const latestRef = query(ref(db, "discussions"), orderByChild("postedAt"), limitToLast(3));

// Ensure these helper functions are at the top of your home page script 
function esc(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function rel(ts) { 
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 3600) return Math.floor(s/60) + "m ago";
    if (s < 86400) return Math.floor(s/3600) + "h ago";
    return Math.floor(s/86400) + "d ago";
}

onValue(latestRef, (snapshot) => {
  const data = snapshot.val();
  const list = document.getElementById("latestFloorPosts");
  if (!list || !data) return;

  const items = Object.entries(data)
    .map(([key, val]) => ({ ...val, _key: key }))
    .sort((a, b) => b.postedAt - a.postedAt);

  list.innerHTML = items.map(d => {
    const commentCount = d.comments ? Object.keys(d.comments).length : 0;
    return `
    <div class="home-post-card" onclick="window.location.href='the-floor.html?post=${d._key}'">
      <div class="hp-content">
        <h4 class="hp-title">${esc(d.title)}</h4>
        <p class="hp-body">${esc(d.body.substring(0, 120))}...</p>
        
        <div class="hp-meta">
          <span class="hp-author">
            <span class="hp-av" style="background:#c9a84c">${esc(d.authorInitials || "??")}</span>
            ${esc(d.author)}
          </span>
          <span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ${rel(d.postedAt)}</span>
          <span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> ${commentCount}</span>
        </div>

        <div class="hp-reactions">
          <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg> ${d.likes || 0}</span>
          <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg> ${d.dislikes || 0}</span>
        </div>
      </div>
    </div>`;
  }).join("");
});