// ─────────────────────────────────────────────
//  points.js — Engagement Points System (member-facing)
// ─────────────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getDatabase, ref, onValue, push, set } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-storage.js";
import { firebaseConfig } from './config.js';
import { profileAvatarHtml } from './profile-link.js';
import { validateEvidenceFile } from './upload-validation.js';
import {
  RUBRIC, getActivity, getOption, formatOptionLabel, memberDisplayName,
  computeMemberTotal, computeAllTotals, rankLeaderboard, todayDateStr,
  validateActivityDate, resolveSelection, MIN_ACTIVITY_DATE
} from './points-rubric.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const storage = getStorage(app);

let currentUser = null;
let usersTree = {};
let viewingUid = null;

let pendingEvidenceFile = null;
let toastTimer = null;

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = 'toast toast--' + type + ' toast--visible';
  // Clear any in-flight timer so a second toast doesn't get cut short by the
  // first one's countdown.
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('toast--visible');
    toastTimer = null;
  }, 3500);
}

// ── AUTH ENTRY POINT ──────────────────────────────────────────────────────

// Wired once, unconditionally — these are static elements that are never
// recreated, so this must not run more than once (unlike onAuthStateChanged,
// which Firebase can in principle invoke again later and would otherwise
// stack duplicate listeners, e.g. double-submitting a request per click).
wireStaticControls();

let routeApplied = false;

onAuthStateChanged(auth, (user) => {
  if (!user) { window.location.href = "auth.html"; return; }
  currentUser = user;
  populateActivitySelect();
  renderRubricList();
  subscribeToUsers();
});

window.addEventListener('popstate', () => {
  applyRouteFromUrl();
  renderCurrentView();
});

// Live subscription rather than a one-time read: the leaderboard and a member's
// own totals have to reflect an award the moment an admin grants or corrects it.
function subscribeToUsers() {
  onValue(ref(db, 'users'), (snap) => {
    usersTree = snap.val() || {};
    if (!routeApplied) {
      applyRouteFromUrl();
      routeApplied = true;
    }
    renderCurrentView();
  }, (error) => {
    console.error('Points data read failed:', error);
    const board = document.getElementById('leaderboardList');
    if (board) {
      board.innerHTML = `<div class="empty-state"><div class="empty-text">Could not load points data. Please refresh, or contact an Exec Board member if this keeps happening.</div></div>`;
    }
  });
}

// Decides which view is active from the URL. Does not render — renderCurrentView
// does that, so a data update and a navigation both go through one path.
function applyRouteFromUrl() {
  const uid = new URLSearchParams(window.location.search).get('uid');
  if (uid && usersTree[uid]) {
    viewingUid = uid;
    setActiveView('member');
  } else {
    viewingUid = null;
    setActiveView('leaderboard');
  }
}

function renderCurrentView() {
  renderMyPointsCard();
  if (viewingUid) renderMemberDetail(viewingUid);
  else renderLeaderboard();
}

// ── VIEW SWITCHING ────────────────────────────────────────────────────────

function setActiveView(which) {
  const leaderboard = document.getElementById('viewLeaderboard');
  const member = document.getElementById('viewMember');
  leaderboard.classList.toggle('active', which === 'leaderboard');
  member.classList.toggle('active', which === 'member');
}

function navigateToMember(uid) {
  if (!uid) return;
  history.pushState(null, '', `points.html?uid=${encodeURIComponent(uid)}`);
  viewingUid = uid;
  setActiveView('member');
  renderCurrentView();
}

function navigateToLeaderboard() {
  history.pushState(null, '', 'points.html');
  viewingUid = null;
  setActiveView('leaderboard');
  renderCurrentView();
}

// ── LEADERBOARD ───────────────────────────────────────────────────────────

function renderMyPointsCard() {
  const u = usersTree[currentUser.uid] || {};
  document.getElementById('myTotalPoints').textContent = computeMemberTotal(u.pointAwards);
}

function renderLeaderboard() {
  const el = document.getElementById('leaderboardList');
  const ranked = rankLeaderboard(computeAllTotals(usersTree));

  if (!ranked.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-text">No members yet.</div></div>`;
    return;
  }

  el.innerHTML = ranked.map(r => {
    const isYou = r.uid === currentUser.uid;
    const label = `${r.name}${isYou ? ' (you)' : ''}, rank ${r.rank}, ${r.total} points`;
    return `
    <div class="lb-row ${isYou ? 'lb-you' : ''}" data-uid="${esc(r.uid)}"
         role="button" tabindex="0" aria-label="${esc(label)}">
      <div class="lb-rank ${r.rank === 1 ? 'lb-rank--1' : ''}" aria-hidden="true">${r.rank === 1 ? '🏆' : '#' + r.rank}</div>
      <div class="lb-name-wrap">
        ${profileAvatarHtml(r.uid, "span", "avatar-sm", "", esc((r.name || '?').substring(0, 2).toUpperCase()), { stopPropagation: true, role: r.role })}
        <span class="lb-name">${esc(r.name)}${isYou ? ' (You)' : ''}</span>
      </div>
      <div class="lb-points">${r.total} pts</div>
    </div>`;
  }).join('');

  el.querySelectorAll('.lb-row').forEach(row => {
    const go = () => navigateToMember(row.dataset.uid);
    row.addEventListener('click', go);
    row.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
    });
  });
}

// ── MEMBER DETAIL ─────────────────────────────────────────────────────────

function renderMemberDetail(uid) {
  const u = usersTree[uid];
  const body = document.getElementById('memberBody');
  const topActions = document.getElementById('memberTopActions');

  if (!u) {
    body.innerHTML = `<div class="empty-state"><div class="empty-text">Member not found.</div></div>`;
    topActions.innerHTML = '';
    return;
  }

  const isOwn = uid === currentUser.uid;
  const total = computeMemberTotal(u.pointAwards);
  const name = memberDisplayName(u);

  topActions.innerHTML = isOwn ? `<button class="topbar-btn" id="memberRequestBtn">Request Points</button>` : '';
  if (isOwn) document.getElementById('memberRequestBtn').addEventListener('click', openRequestModal);

  const awards = Object.entries(u.pointAwards || {})
    .map(([id, a]) => ({ id, ...a }))
    .sort((a, b) => (b.awardedAt || 0) - (a.awardedAt || 0));

  const historyRows = awards.length ? awards.map(a => {
    const label = formatOptionLabel(a.activity);
    let statusHtml = '';
    if (a.revoked) statusHtml = `<span class="status-pill status-pill--revoked">Revoked</span>`;
    else if (a.correctionOf) statusHtml = `<span class="status-pill status-pill--corrected">Correction</span>`;
    return `<tr>
      <td>${esc(label)}</td>
      <td>${a.revoked ? '<s>' : ''}${a.points > 0 ? '+' : ''}${a.points}${a.revoked ? '</s>' : ''}</td>
      <td>${esc(a.activityDate || '—')}</td>
      <td>${esc(a.awardedByName || '—')}</td>
      <td class="hist-note">${esc(a.note || '') || '—'}${statusHtml ? ' ' + statusHtml : ''}${a.revoked && a.revocationReason ? `<div>Reason: ${esc(a.revocationReason)}</div>` : ''}</td>
    </tr>`;
  }).join('') : `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px;">No point history yet.</td></tr>`;

  let requestsSection = '';
  if (isOwn) {
    const requests = Object.entries(u.pointRequests || {})
      .map(([id, r]) => ({ id, ...r }))
      .sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));

    const reqRows = requests.length ? requests.map(r => {
      const activity = getActivity(r.activity);
      const claimed = r.claimedOptionKey ? getOption(r.claimedOptionKey) : null;
      const label = (activity ? activity.label : r.activity) + (claimed ? ` — ${claimed.option.label}` : '');
      return `<tr>
        <td>${esc(label)}</td>
        <td>${esc(r.activityDate || '—')}</td>
        <td class="hist-note">${esc(r.description || '')}${r.evidenceUrl ? `<div><a href="${esc(r.evidenceUrl)}" target="_blank" rel="noopener">View evidence</a></div>` : ''}</td>
        <td><span class="status-pill status-pill--${esc(r.status)}">${esc(r.status)}</span>${r.adminNote ? `<div class="hist-note">Admin note: ${esc(r.adminNote)}</div>` : ''}</td>
      </tr>`;
    }).join('') : `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:24px;">No requests yet.</td></tr>`;

    requestsSection = `
      <div class="section-title">My Requests</div>
      <div class="history-table-wrap">
        <table class="history-table">
          <thead><tr><th>Activity</th><th>Date</th><th>Description</th><th>Status</th></tr></thead>
          <tbody>${reqRows}</tbody>
        </table>
      </div>`;
  }

  body.innerHTML = `
    <div class="member-header">
      ${profileAvatarHtml(uid, "div", "member-avatar-lg", "", esc((name || '?').substring(0, 2).toUpperCase()), { role: u.role })}
      <div>
        <div class="member-header-name">${esc(name)}${isOwn ? ' (You)' : ''}</div>
        <div class="member-header-total">TOTAL ENGAGEMENT POINTS: <b>${total}</b></div>
      </div>
    </div>

    <div class="section-title">Point History</div>
    <div class="history-table-wrap">
      <table class="history-table">
        <thead><tr><th>Activity</th><th>Points</th><th>Date</th><th>Awarded By</th><th>Note</th></tr></thead>
        <tbody>${historyRows}</tbody>
      </table>
    </div>

    ${requestsSection}
  `;
}

// ── REQUEST POINTS MODAL ─────────────────────────────────────────────────

function populateActivitySelect() {
  const sel = document.getElementById('reqActivity');
  sel.innerHTML = '<option value="">Select an activity…</option>' +
    RUBRIC.map(a => `<option value="${esc(a.key)}">${esc(a.label)}${a.weeklyLimit ? ` (max ${a.weeklyLimit}/week)` : ''}</option>`).join('');
}

function populateOptionSelect(activityKey) {
  const sel = document.getElementById('reqOption');
  const hint = document.getElementById('reqOptionRequirements');
  if (!activityKey) {
    sel.innerHTML = '<option value="">Select an activity first…</option>';
    sel.disabled = true;
    hint.textContent = '';
    return;
  }
  const activity = getActivity(activityKey);
  sel.disabled = false;
  sel.innerHTML = '<option value="">Select a credit level…</option>' +
    activity.options.map(o => `<option value="${esc(o.key)}">${esc(o.label)} (${o.points > 0 ? '+' : ''}${o.points} pts)</option>`).join('');
  hint.textContent = '';
}

function openRequestModal() {
  const dateEl = document.getElementById('reqDate');
  dateEl.value = todayDateStr();
  dateEl.max = todayDateStr();
  dateEl.min = MIN_ACTIVITY_DATE;
  document.getElementById('reqDescription').value = '';
  document.getElementById('reqActivity').value = '';
  populateOptionSelect(null);
  clearEvidence();
  document.getElementById('reqError').style.display = 'none';
  openModal('requestModal');
}

function showFormError(el, msg) {
  el.textContent = msg;
  el.style.display = 'block';
}

function clearEvidence() {
  pendingEvidenceFile = null;
  document.getElementById('reqEvidenceFile').value = '';
  document.getElementById('reqEvidencePreview').style.display = 'none';
  document.getElementById('reqEvidencePreview').innerHTML = '';
  document.getElementById('reqEvidenceError').style.display = 'none';
}

// Returns { url, name, storagePath } so the caller can clean the object up
// again if the database write that was supposed to reference it fails.
async function uploadEvidence(uid) {
  if (!pendingEvidenceFile) return { url: null, name: null, storagePath: null };
  const fileName = `${Date.now()}_${pendingEvidenceFile.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
  const storagePath = `point_evidence/${uid}/${fileName}`;
  const sRef = storageRef(storage, storagePath);
  await uploadBytes(sRef, pendingEvidenceFile);
  const url = await getDownloadURL(sRef);
  return { url, name: pendingEvidenceFile.name, storagePath };
}

async function submitRequest() {
  const btn = document.getElementById('submitRequestBtn');
  const errEl = document.getElementById('reqError');
  errEl.style.display = 'none';

  const activityKey = document.getElementById('reqActivity').value;
  const optionKey = document.getElementById('reqOption').value;
  const activityDate = document.getElementById('reqDate').value;
  const description = document.getElementById('reqDescription').value.trim();

  const selection = resolveSelection(activityKey, optionKey);
  if (selection.error) return showFormError(errEl, selection.error);

  const dateError = validateActivityDate(activityDate);
  if (dateError) return showFormError(errEl, dateError);

  if (!description) return showFormError(errEl, 'Please provide a short description.');
  if (description.length > 2000) {
    return showFormError(errEl, 'Please keep the description under 2000 characters.');
  }

  // Accidental double submissions (double-tap, a second tab, a back-button
  // replay) would otherwise create two identical pending requests for an admin
  // to untangle.
  const myRequests = (usersTree[currentUser.uid] || {}).pointRequests || {};
  const duplicate = Object.values(myRequests).some(r =>
    r && r.status === 'pending' && r.activity === activityKey && r.activityDate === activityDate
  );
  if (duplicate) {
    return showFormError(errEl, 'You already have a pending request for this activity on this date.');
  }

  btn.disabled = true;
  btn.textContent = 'Submitting…';
  let uploaded = { url: null, name: null, storagePath: null };
  try {
    uploaded = await uploadEvidence(currentUser.uid);
    await set(push(ref(db, `users/${currentUser.uid}/pointRequests`)), {
      memberId: currentUser.uid,
      memberName: memberDisplayName(usersTree[currentUser.uid]) || currentUser.email,
      activity: activityKey,
      claimedOptionKey: optionKey,
      activityDate,
      description,
      evidenceUrl: uploaded.url,
      evidenceFileName: uploaded.name,
      submittedAt: Date.now(),
      status: 'pending'
    });
    closeModal('requestModal');
    showToast('Request submitted. An admin will review it.', 'success');
    // No manual refresh needed — the live subscription re-renders on its own.
  } catch (err) {
    console.error(err);
    // The evidence file was uploaded but nothing references it now, so remove
    // it instead of leaving an orphan sitting in Storage forever.
    if (uploaded.storagePath) {
      try {
        await deleteObject(storageRef(storage, uploaded.storagePath));
      } catch (cleanupError) {
        console.warn('Could not clean up orphaned evidence upload:', cleanupError);
      }
    }
    showFormError(errEl, 'Failed to submit request. Please check your connection and try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Submit Request';
  }
}

// ── RULES / RUBRIC MODAL ─────────────────────────────────────────────────

function renderRubricList() {
  const el = document.getElementById('rubricList');
  el.innerHTML = RUBRIC.map(activity => `
    <div class="rubric-activity">
      <div class="rubric-activity-title">${esc(activity.label)}</div>
      ${activity.weeklyLimit ? `<div class="rubric-activity-limit">MAXIMUM ${activity.weeklyLimit} PER WEEK</div>` : ''}
      ${activity.requirements.length ? `<div class="rubric-activity-note">${activity.requirements.map(esc).join(' · ')}</div>` : ''}
      ${activity.options.map(o => `
        <div class="rubric-option">
          <div class="rubric-option-head">
            <span class="rubric-option-label">${esc(o.label)}</span>
            <span class="rubric-option-points">${o.points > 0 ? '+' : ''}${o.points} pts</span>
          </div>
          ${o.requirements.length ? `<ul class="rubric-option-reqs">${o.requirements.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
        </div>
      `).join('')}
    </div>
  `).join('');
}

// ── STATIC CONTROL WIRING ────────────────────────────────────────────────

function wireStaticControls() {
  document.getElementById('viewMyHistoryBtn').addEventListener('click', () => navigateToMember(currentUser.uid));
  document.getElementById('requestPointsBtn').addEventListener('click', openRequestModal);
  document.getElementById('backToLeaderboardBtn').addEventListener('click', navigateToLeaderboard);
  document.getElementById('openRulesBtn').addEventListener('click', () => openModal('rulesModal'));
  document.getElementById('closeRulesModal').addEventListener('click', () => closeModal('rulesModal'));
  document.getElementById('closeRequestModal').addEventListener('click', () => closeModal('requestModal'));
  document.getElementById('submitRequestBtn').addEventListener('click', submitRequest);

  document.getElementById('reqActivity').addEventListener('change', (e) => populateOptionSelect(e.target.value || null));
  document.getElementById('reqOption').addEventListener('change', (e) => {
    const found = e.target.value ? getOption(e.target.value) : null;
    document.getElementById('reqOptionRequirements').textContent =
      found && found.option.requirements.length ? 'Typically requires: ' + found.option.requirements.join('; ') : '';
  });

  document.getElementById('reqEvidenceTrigger').addEventListener('click', () => document.getElementById('reqEvidenceFile').click());
  document.getElementById('reqEvidenceFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    const errEl = document.getElementById('reqEvidenceError');
    if (!file) return;
    const fileError = validateEvidenceFile(file);
    if (fileError) {
      errEl.textContent = fileError;
      errEl.style.display = 'block';
      e.target.value = '';
      pendingEvidenceFile = null;
      return;
    }
    errEl.style.display = 'none';
    pendingEvidenceFile = file;
    const preview = document.getElementById('reqEvidencePreview');
    preview.style.display = 'flex';
    preview.innerHTML = `<span>📎 ${esc(file.name)}</span> <button type="button" id="reqEvidenceRemove">Remove</button>`;
    document.getElementById('reqEvidenceRemove').addEventListener('click', clearEvidence);
  });

  document.querySelectorAll('.modal-overlay').forEach(o =>
    o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); })
  );
}
