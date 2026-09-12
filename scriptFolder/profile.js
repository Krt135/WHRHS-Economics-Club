import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getDatabase, ref, get, update } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";
import { firebaseConfig } from "./config.js";

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getDatabase(app);


// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────

function esc(s) {
  return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function rel(ts) {
  if (!ts) return "just now";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)    return "just now";
  if (s < 3600)  return Math.floor(s / 60)   + " min ago";
  if (s < 86400) return Math.floor(s / 3600) + " hours ago";
  return Math.floor(s / 86400) + " days ago";
}

/** Firebase Auth UIDs are alphanumeric; reject anything else. */
function parseProfileUidParam() {
  const raw = new URLSearchParams(window.location.search).get("uid");
  if (!raw) return null;
  const uid = raw.trim();
  if (!uid || uid.length > 128 || !/^[a-zA-Z0-9]+$/.test(uid)) return null;
  return uid;
}

function showToast(msg, type = "success") {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.className = "toast toast--" + type + " toast--visible";
  setTimeout(() => toast.classList.remove("toast--visible"), 3500);
}

function setRoleBadge(roleBadge, data) {
  const role = (data.role || "member").toUpperCase().replace(/_/g, " ");
  roleBadge.textContent = role;
  roleBadge.classList.toggle("role--exec", data.role === "admin" || data.role === "exec_board");
}

function showProfileError() {
  document.getElementById("profile-error-state").hidden = false;
  document.getElementById("profile-app-body").hidden = true;
}

function showProfileApp() {
  document.getElementById("profile-error-state").hidden = true;
  document.getElementById("profile-app-body").hidden = false;
}


// ─────────────────────────────────────────────
//  ACTIVITY TAB
// ─────────────────────────────────────────────

// Badge colour per post type
const ACTIVITY_TYPE = {
  discussion:  { label: 'The Floor',     color: '#0f1f3d', sessionKey: 'openFloorPost',   page: 'the-floor.html'      },
  perspective: { label: 'Perspectives',  color: '#7c3aed', sessionKey: 'openPerspective', page: 'perspectives.html'   },
  feature:     { label: 'Weekly Feature',color: '#c9a84c', sessionKey: 'openFeature',     page: 'weekly-feature.html' },
  lesson:      { label: 'Academy',       color: '#16a34a', sessionKey: null,              page: 'the-academy.html'    },
};

// Navigate to a post from the activity list.
// Called from inline onclick in rendered HTML so must be on window.
window.navigateToActivity = function(type, id) {
  const cfg = ACTIVITY_TYPE[type];
  if (!cfg) return;
  if (cfg.sessionKey) sessionStorage.setItem(cfg.sessionKey, id);
  window.location.href = cfg.page;
};

function renderActivityList(items) {
  if (!items.length) {
    return '<p class="activity-empty">No posts yet.</p>';
  }

  return items.map(item => {
    const cfg = ACTIVITY_TYPE[item.type];
    return `
      <div class="activity-item" onclick="navigateToActivity('${item.type}','${item.id}')">
        <div class="activity-item-top">
          <span class="activity-badge" style="background:${cfg.color}">${esc(cfg.label)}</span>
          <span class="activity-time">${rel(item.postedAt)}</span>
        </div>
        <div class="activity-title">${esc(item.title)}</div>
        ${item.excerpt ? `<div class="activity-excerpt">${esc(item.excerpt)}</div>` : ''}
      </div>`;
  }).join('');
}

async function loadActivity(uid) {
  const el = document.getElementById('activity-list');
  if (!el) return;

  el.innerHTML = '<p class="activity-loading">Loading activity…</p>';

  try {
    // Fetch all four paths concurrently
    const [discSnap, perspSnap, featSnap, lessonSnap] = await Promise.all([
      get(ref(db, 'discussions')),
      get(ref(db, 'perspectives')),
      get(ref(db, 'features')),
      get(ref(db, 'lessons')),
    ]);

    const items = [];

    // ── The Floor discussions ──
    if (discSnap.exists()) {
      Object.entries(discSnap.val()).forEach(([key, d]) => {
        if (d.authorId !== uid || d.deleted) return;
        // Discussions have no title field — use the first line of body as the title
        const body = d.body || '';
        items.push({
          id: key, type: 'discussion',
          title:   body.slice(0, 80) + (body.length > 80 ? '…' : ''),
          excerpt: body.length > 80 ? body.slice(80, 160) + (body.length > 160 ? '…' : '') : '',
          postedAt: d.postedAt || 0,
        });
      });
    }

    // ── Perspectives essays ──
    if (perspSnap.exists()) {
      Object.entries(perspSnap.val()).forEach(([key, p]) => {
        if (p.authorId !== uid || p.deleted) return;
        const raw = p.richText ? (p.contentText || '') : (p.content || '');
        items.push({
          id: key, type: 'perspective',
          title:   p.title || '(untitled)',
          excerpt: raw.slice(0, 120) + (raw.length > 120 ? '…' : ''),
          postedAt: p.postedAt || 0,
        });
      });
    }

    // ── Weekly Feature articles ──
    if (featSnap.exists()) {
      Object.entries(featSnap.val()).forEach(([key, f]) => {
        if (f.authorId !== uid || f.deleted) return;
        const raw = f.richText ? (f.contentText || '') : (f.content || '');
        items.push({
          id: key, type: 'feature',
          title:   f.title || '(untitled)',
          excerpt: raw.slice(0, 120) + (raw.length > 120 ? '…' : ''),
          postedAt: f.postedAt || 0,
        });
      });
    }

    // ── Academy lessons ──
    if (lessonSnap.exists()) {
      Object.entries(lessonSnap.val()).forEach(([key, l]) => {
        if (l.authorId !== uid || l.deleted) return;
        // Use the short description as excerpt if available, else plain-text content
        const raw = l.richText ? (l.contentText || '') : (l.content || '');
        items.push({
          id: key, type: 'lesson',
          title:   l.title || '(untitled)',
          excerpt: l.desc || raw.slice(0, 120) + (raw.length > 120 ? '…' : ''),
          postedAt: l.postedAt || 0,
        });
      });
    }

    // Sort newest first, cap at 10
    items.sort((a, b) => b.postedAt - a.postedAt);
    el.innerHTML = renderActivityList(items.slice(0, 10));

  } catch (err) {
    console.error('Activity load error:', err);
    el.innerHTML = '<p class="activity-empty">Could not load activity.</p>';
  }
}


// ─────────────────────────────────────────────
//  OWN PROFILE
// ─────────────────────────────────────────────

function wireOwnProfile(user, data) {
  const displayNameEl    = document.getElementById("field-display-name");
  const primaryEmailEl   = document.getElementById("field-primary-email");
  const secondaryEmailEl = document.getElementById("field-secondary-email");
  const bioEl            = document.getElementById("field-bio");
  const phoneEl          = document.getElementById("field-phone");
  const roleBadge        = document.getElementById("role-badge");
  const mainEl           = document.getElementById("profile-main");

  mainEl.classList.remove("profile-main--viewing-member");
  showProfileApp();

  document.getElementById("profile-points-link").href = `points.html?uid=${encodeURIComponent(user.uid)}`;

  document.title = "Your Profile – The Economic Forum";
  document.getElementById("profile-page-title").textContent = "Your Profile";
  document.getElementById("profile-page-subtitle").textContent =
    "Manage your account settings and notification preferences.";
  document.getElementById("profile-account-card-title-text").textContent = "Account Information";

  document.getElementById("field-group-primary-email").hidden = false;
  document.getElementById("field-group-secondary-email").hidden = false;
  document.getElementById("field-group-member-phone").hidden = true;
  document.getElementById("profile-card-notifications").hidden = false;

  const actionsEl = document.getElementById("profile-actions");
  actionsEl.hidden = false;
  actionsEl.removeAttribute("aria-hidden");
  actionsEl.querySelectorAll("button").forEach(b => b.removeAttribute("tabindex"));

  document.getElementById("label-primary-email").textContent = "Primary Email (Login)";
  document.getElementById("hint-primary-email").hidden = false;

  [displayNameEl, bioEl, secondaryEmailEl].forEach(el => {
    el.removeAttribute("readonly");
    el.removeAttribute("aria-readonly");
  });
  phoneEl.removeAttribute("readonly");

  displayNameEl.value    = data.displayName || user.email || "";
  primaryEmailEl.value   = user.email || "";
  secondaryEmailEl.value = data.secondaryEmail || "";
  bioEl.value            = data.bio || "";
  phoneEl.value          = data.phone || "";

  document.getElementById("toggle-email-notif").checked = data.emailNotifications !== false;
  const phoneToggle = document.getElementById("toggle-phone-notif");
  if (phoneToggle) phoneToggle.checked = data.phoneNotifications === true;

  setRoleBadge(roleBadge, data);

  if (data.role === "admin" || data.role === "exec_board") {
    document.getElementById("admin-link-wrap")?.style.removeProperty("display");
  }

  document.getElementById("btn-save").onclick = async () => {
    const btn = document.getElementById("btn-save");
    btn.disabled = true;
    btn.textContent = "Saving…";
    const updates = {
      displayName:        document.getElementById("field-display-name").value.trim(),
      secondaryEmail:     document.getElementById("field-secondary-email").value.trim(),
      bio:                document.getElementById("field-bio").value.trim(),
      phone:              document.getElementById("field-phone").value.trim(),
      emailNotifications: document.getElementById("toggle-email-notif").checked,
      phoneNotifications: document.getElementById("toggle-phone-notif")?.checked ?? false,
    };
    try {
      await update(ref(db, `users/${user.uid}`), updates);
      showToast("Changes saved successfully.", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to save. Please try again.", "error");
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save Changes`;
    }
  };

  document.getElementById("btn-signout").onclick = async () => {
    await signOut(auth);
    window.location.href = "index.html";
  };
}


// ─────────────────────────────────────────────
//  MEMBER PROFILE
// ─────────────────────────────────────────────

function wireMemberProfile(data, uid) {
  const mainEl           = document.getElementById("profile-main");
  const displayNameEl    = document.getElementById("field-display-name");
  const bioEl            = document.getElementById("field-bio");
  const roleBadge        = document.getElementById("role-badge");
  const primaryEmailEl   = document.getElementById("field-primary-email");
  const secondaryEmailEl = document.getElementById("field-secondary-email");
  const phoneMemberEl    = document.getElementById("field-member-phone");

  mainEl.classList.add("profile-main--viewing-member");
  showProfileApp();

  document.getElementById("profile-points-link").href = `points.html?uid=${encodeURIComponent(uid)}`;

  const name = (data.displayName || "").trim() || "Member";
  document.title = `${name} – The Economic Forum`;
  document.getElementById("profile-page-title").textContent = name;
  document.getElementById("profile-page-subtitle").innerHTML =
    'Club member profile. <a href="profile.html">Your profile &amp; settings</a>';
  document.getElementById("profile-account-card-title-text").textContent = "Profile";

  const emailPrimary   = (data.email         || "").trim();
  const emailSecondary = (data.secondaryEmail || "").trim();
  const phone          = (data.phone          || "").trim();

  document.getElementById("field-group-primary-email").hidden = !emailPrimary;
  if (emailPrimary) {
    primaryEmailEl.value = emailPrimary;
    document.getElementById("label-primary-email").textContent = "Email";
    document.getElementById("hint-primary-email").hidden = true;
  }

  document.getElementById("field-group-secondary-email").hidden = !emailSecondary;
  if (emailSecondary) {
    secondaryEmailEl.value = emailSecondary;
    secondaryEmailEl.readOnly = true;
    secondaryEmailEl.setAttribute("aria-readonly", "true");
  } else {
    secondaryEmailEl.value = "";
    secondaryEmailEl.removeAttribute("readonly");
    secondaryEmailEl.removeAttribute("aria-readonly");
  }

  const phoneGroup = document.getElementById("field-group-member-phone");
  phoneGroup.hidden = !phone;
  if (phone) {
    phoneMemberEl.value = phone;
    phoneMemberEl.readOnly = true;
    phoneMemberEl.setAttribute("aria-readonly", "true");
  } else {
    phoneMemberEl.value = "";
    phoneMemberEl.removeAttribute("readonly");
    phoneMemberEl.removeAttribute("aria-readonly");
  }

  document.getElementById("profile-card-notifications").hidden = true;

  const actionsEl = document.getElementById("profile-actions");
  actionsEl.hidden = true;
  actionsEl.setAttribute("aria-hidden", "true");
  actionsEl.querySelectorAll("button").forEach(b => b.setAttribute("tabindex", "-1"));

  displayNameEl.value = name;
  displayNameEl.readOnly = true;
  displayNameEl.setAttribute("aria-readonly", "true");

  bioEl.value = (data.bio || "").trim();
  bioEl.readOnly = true;
  bioEl.setAttribute("aria-readonly", "true");
  bioEl.placeholder = "No bio yet.";

  setRoleBadge(roleBadge, data);

  document.getElementById("btn-save").onclick    = null;
  document.getElementById("btn-signout").onclick = null;
}


// ─────────────────────────────────────────────
//  AUTH ENTRY POINT
// ─────────────────────────────────────────────

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "auth.html";
    return;
  }

  let viewUid = parseProfileUidParam();
  if (viewUid && viewUid === user.uid) {
    history.replaceState(null, "", "profile.html");
    viewUid = null;
  }

  if (viewUid) {
    let snap;
    try {
      snap = await get(ref(db, `users/${viewUid}`));
    } catch (e) {
      console.error(e);
      showProfileError();
      document.title = "Profile unavailable – The Economic Forum";
      return;
    }
    if (!snap.exists()) {
      showProfileError();
      document.title = "Profile unavailable – The Economic Forum";
      return;
    }
    wireMemberProfile(snap.val() || {}, viewUid);
    loadActivity(viewUid);   // ← load activity for the member being viewed
    return;
  }

  try {
    const snap = await get(ref(db, `users/${user.uid}`));
    const data = snap.val() || {};
    wireOwnProfile(user, data);
    loadActivity(user.uid);    // ← load activity for own profile
  } catch (e) {
    console.error(e);
    showProfileError();
    document.title = "Profile unavailable – The Economic Forum";
  }
});

window._tefSignOut = () => signOut(auth).then(() => (window.location.href = "index.html"));