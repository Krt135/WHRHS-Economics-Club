import { app } from './app.js';
import { getDatabase, ref, onValue, update, remove, get, set, push } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { profileAvatarHtml } from "./profile-link.js";
import {
    RUBRIC, getActivity, getOption, formatOptionLabel, memberDisplayName,
    computeAllTotals, rankLeaderboard, countActiveInWeek, todayDateStr,
    validateActivityDate, resolveSelection, parsePointsValue, MIN_ACTIVITY_DATE
} from "./points-rubric.js";


const db = getDatabase(app);
const auth = getAuth(app);

let currentTab = 'approvals';
let unsubscribe = null;
let pointsSubTab = 'totals'; // 'totals' | 'awards' | 'requests'
let adminIdentity = null;    // { uid, name } for the signed-in admin

// Nothing loads until the signed-in user is confirmed to be an admin. The
// Firebase rules are what actually enforce this, but starting the data
// listeners first would briefly render the full member roster to whoever
// opened the page before the redirect landed.
onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "auth.html"; return; }
    try {
        const snap = await get(ref(db, `users/${user.uid}`));
        const data = snap.val();
        if (!data || data.role !== 'admin') {
            window.location.href = "index.html";
            return;
        }
        adminIdentity = { uid: user.uid, name: data.displayName || user.email };
        loadData();
    } catch (err) {
        console.error('Admin check failed:', err);
        window.location.href = "index.html";
    }
});

// Note the `== null` test rather than a falsy check: esc(0) must render "0",
// not an empty string.
function esc(s) {
    return String(s == null ? "" : s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

let toastTimer = null;
function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = 'toast toast--' + type + ' toast--visible';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove('toast--visible');
        toastTimer = null;
    }, 3500);
}

// Strip HTML tags for plain-text previews (post body/content may be Quill-generated HTML).
function stripHtml(html) {
    return String(html || "").replace(/<[^>]*>/g, "");
}

// A legacy row can be missing displayName and email entirely; calling
// .substring on undefined would throw and blank out the whole list.
function initialsFor(user) {
    const source = (user && (user.displayName || user.email)) || '?';
    return String(source).substring(0, 2).toUpperCase();
}

export function switchTab(tab, btnEl) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    loadData();
}
window.switchTab = switchTab;

function loadData() {
    const content = document.getElementById('tab-content');
    content.innerHTML = `<p class="empty-state">Fetching data from the Forum...</p>`;

    // Unsubscribe previous listener if any
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }

    if (currentTab === 'approvals' || currentTab === 'members') {
        const usersRef = ref(db, 'users');
        unsubscribe = onValue(usersRef, (snapshot) => {
            const data = snapshot.val();
            const pendingCount = document.getElementById('count-pending');

            if (!data) {
                pendingCount.innerText = "0";
                content.innerHTML = `<p class="empty-state">No records found.</p>`;
                return;
            }

            // Kept fresh here (not just while the Points tab is open) so the
            // "Give Points" shortcut on the Members tab always has data to
            // populate the modal with, regardless of which tab was visited first.
            latestUsersObj = data;

            const userArray = Object.entries(data).map(([id, val]) => ({ id, ...val }));
            const pending = userArray.filter(u => u.status === 'pending');
            pendingCount.innerText = pending.length;

            if (currentTab === 'approvals') {
                renderApprovals(pending, content);
            } else {
                // A user's own sign-in gate only ever blocks the exact string
                // "pending" (see auth.js) - anything else (a missing status
                // field, a typo, a stray value from a manual edit) lets them
                // sign in and use the site fully, while never matching either
                // this strict 'approved' filter or the Approvals tab's strict
                // 'pending' filter. Surface those accounts separately instead
                // of letting them stay invisible to every admin view.
                const unrecognized = userArray.filter(u => u.status !== 'approved' && u.status !== 'pending');
                renderMembers(userArray.filter(u => u.status === 'approved'), content, unrecognized);
            }
        }, (error) => {
            console.error("Firebase Read Error:", error);
            content.innerHTML = `
                <div class="empty-state" style="color:#dc2626;border:1px solid #fecdd3;padding:20px;border-radius:8px;">
                    <p><strong>Access Denied</strong></p>
                    <p>Ensure your account is set to 'admin' in the database.</p>
                    <small>${error.message}</small>
                </div>`;
                window.location.href = "auth.html";
        });

    } else if (currentTab === 'moderation') {
        const binRef = ref(db, 'deleted_posts');
        unsubscribe = onValue(binRef, (snapshot) => {
            const data = snapshot.val();
            if (!data) {
                content.innerHTML = `<p class="empty-state">The recycling bin is empty.</p>`;
                return;
            }
            const posts = Object.entries(data).map(([id, val]) => ({ id, ...val }))
                .sort((a, b) => (b._deletedAt || 0) - (a._deletedAt || 0));
            renderModeration(posts, content);
        });

    } else if (currentTab === 'points') {
        const usersRef = ref(db, 'users');
        unsubscribe = onValue(usersRef, (snapshot) => {
            renderPointsTab(snapshot.val() || {}, content);
        }, (error) => {
            console.error("Firebase Read Error:", error);
            content.innerHTML = `<p class="empty-state">Could not load points data: ${esc(error.message)}</p>`;
        });
    }
}

// ── APPROVALS ────────────────────────────────────────────────────────────────

function renderApprovals(list, container) {
    if (list.length === 0) {
        container.innerHTML = `<p class="empty-state">No pending approvals.</p>`;
        return;
    }
    container.innerHTML = list.map(user => `
        <div class="admin-list-item">
            <div class="member-info">
                <div class="member-avatar">${esc(initialsFor(user))}</div>
                <div>
                    <div class="member-name">${esc(memberDisplayName(user))}</div>
                    <div class="member-email">${esc(user.email) || '—'}</div>
                </div>
            </div>
            <div class="admin-actions">
                <button class="btn-approve" onclick="updateStatus('${user.id}', 'approved')">Approve</button>
                <button class="btn-deny" onclick="denyUser('${user.id}')">Deny</button>
            </div>
        </div>
    `).join('');
}

window.updateStatus = (uid, status) => {
    update(ref(db, `users/${uid}`), { status });
};

window.denyUser = (uid) => {
    if (confirm("Deny and delete this request?")) {
        remove(ref(db, `users/${uid}`));
    }
};

// ── MEMBERS ──────────────────────────────────────────────────────────────────

// `unrecognized`: accounts whose status field is neither 'pending' nor
// 'approved' — e.g. missing entirely, or some other value from a manual
// edit. auth.js's sign-in gate only blocks the exact string "pending", so
// these accounts can sign in and use the site fully while being invisible
// to both this list and the Approvals tab. See the note above their group.
function renderMembers(list, container, unrecognized = []) {
    if (list.length === 0 && unrecognized.length === 0) {
        container.innerHTML = `<p class="empty-state">No approved members found.</p>`;
        return;
    }

    const admins = list.filter(u => u.role === 'admin');
    const members = list.filter(u => u.role !== 'admin');

    // Surface duplicate-account data (same email, two separate uid records)
    // rather than silently rendering both as if they were unrelated members.
    const emailCounts = {};
    list.forEach(u => { if (u.email) emailCounts[u.email] = (emailCounts[u.email] || 0) + 1; });

    const renderGroup = (group, label) => {
        if (group.length === 0) return '';
        return `
            <div class="members-group-label">${label} (${group.length})</div>
            ${group.map(user => `
                <div class="admin-list-item">
                    <div class="member-info">
                        ${profileAvatarHtml(
                            user.id,
                            "div",
                            `member-avatar ${user.role === 'admin' ? 'avatar--admin' : ''}`,
                            "",
                            esc(initialsFor(user)),
                            { stopPropagation: true, role: user.role || 'member' }
                        )}
                        <div>
                            <div class="member-name">
                                ${profileAvatarHtml(
                                    user.id,
                                    "span",
                                    "profile-link-name",
                                    "cursor: pointer;",
                                    esc(memberDisplayName(user)),
                                    // No `role` here on purpose: passing it makes profileAvatarHtml
                                    // paint a solid navy/gold BACKGROUND behind this name (that's
                                    // meant for small circular avatar badges elsewhere, not a text
                                    // link). Combined with admin.css forcing this link's text color
                                    // to navy for readability-as-plain-text, a "member" (navy bg)
                                    // rendered navy text on a navy background — invisible. The
                                    // avatar circle two lines above this already shows the role color.
                                    { stopPropagation: true }
                                )}
                                <span class="role-pill role-pill--${esc(user.role || 'member')}">${esc((user.role || 'member').toUpperCase())}</span>
                                <button class="btn-edit-name" title="Edit name" data-edit-name-uid="${esc(user.id)}" data-edit-name-current="${esc(user.displayName || '')}">✏️</button>
                                ${emailCounts[user.email] > 1 ? `<span class="dup-badge" title="Another approved member has this same email — likely a duplicate account. Check before removing either one.">⚠ duplicate email</span>` : ''}
                            </div>
                            <div class="member-email">${esc(user.email)}</div>
                            ${user.secondaryEmail ? `<div class="member-email member-secondary">${esc(user.secondaryEmail)}</div>` : ''}
                            ${user.bio ? `<div class="member-bio">${esc(user.bio)}</div>` : ''}
                        </div>
                    </div>
                    <div class="admin-actions">
                        <button class="btn-approve give-points-btn" data-give-points-uid="${esc(user.id)}">🏆 Give Points</button>
                        ${user.role !== 'admin'
                            ? `<button class="btn-approve" onclick="promoteUser('${user.id}')">Promote</button>`
                            : `<button class="btn-deny" onclick="demoteUser('${user.id}')">Demote</button>`
                        }
                        <button class="btn-deny" onclick="removeUser('${user.id}')">Remove</button>
                    </div>
                </div>
            `).join('')}
        `;
    };

    const unrecognizedHtml = unrecognized.length === 0 ? '' : `
        <div class="members-group-label" style="color:#dc2626;">⚠ NEEDS ATTENTION — UNRECOGNIZED STATUS (${unrecognized.length})</div>
        <p class="empty-state" style="margin:0 0 12px; padding:12px 14px; text-align:left; font-style:normal; border:1px dashed #fecdd3; border-radius:6px;">
            These accounts can sign in and use the site, but their <code>status</code> field is neither
            <code>"pending"</code> nor <code>"approved"</code> — usually from a manual database edit — so they
            never appear in Approvals or above. Click "Mark Approved" to fix one, or Remove it if it shouldn't exist.
        </p>
        ${unrecognized.map(user => `
            <div class="admin-list-item">
                <div class="member-info">
                    <div class="member-avatar">${esc(initialsFor(user))}</div>
                    <div>
                        <div class="member-name">
                            ${esc(memberDisplayName(user))}
                            <span class="status-raw">status: ${user.status === undefined ? '(missing)' : esc(JSON.stringify(user.status))}</span>
                        </div>
                        <div class="member-email">${esc(user.email) || '—'}</div>
                    </div>
                </div>
                <div class="admin-actions">
                    <button class="btn-approve" data-action="fix-approve" data-uid="${esc(user.id)}">Mark Approved</button>
                    <button class="btn-deny" onclick="removeUser('${esc(user.id)}')">Remove</button>
                </div>
            </div>
        `).join('')}
    `;

    container.innerHTML = `
        <div class="members-search-wrap">
            <input class="members-search" type="text" placeholder="Search members…" oninput="filterMembers(this.value)" />
        </div>
        ${unrecognizedHtml}
        <div id="members-list">
            ${renderGroup(admins, 'EXEC BOARD')}
            ${renderGroup(members, 'MEMBERS')}
        </div>
    `;

    container.querySelectorAll('[data-action="fix-approve"]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!confirm('Mark this account as approved? This grants full member access using the same status the normal Approve flow sets.')) return;
            update(ref(db, `users/${btn.dataset.uid}`), { status: 'approved' })
                .then(() => showToast('Status corrected to "approved".', 'success'))
                .catch(err => {
                    console.error(err);
                    showToast('Failed to update status: ' + err.message, 'error');
                });
        });
    });

    container.querySelectorAll('.btn-edit-name').forEach(btn => {
        btn.addEventListener('click', () => {
            const uid = btn.dataset.editNameUid;
            const current = btn.dataset.editNameCurrent;
            const next = prompt('Enter new display name:', current);
            if (next === null) return; // cancelled
            const trimmed = next.trim();
            if (!trimmed) { alert('Name cannot be empty.'); return; }
            if (trimmed.length > 60) { alert('Name is too long (60 characters max).'); return; }
            update(ref(db, `users/${uid}`), { displayName: trimmed })
                .then(() => showToast('Name updated.', 'success'))
                .catch(err => {
                    console.error(err);
                    showToast('Failed to update name: ' + err.message, 'error');
                });
        });
    });

    container.querySelectorAll('.give-points-btn').forEach(btn => {
        btn.addEventListener('click', () => openAddPointsModal(btn.dataset.givePointsUid));
    });
}

window.filterMembers = (query) => {
    const q = query.toLowerCase();
    document.querySelectorAll('#members-list .admin-list-item').forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(q) ? '' : 'none';
    });
};

window.promoteUser = (uid) => {
    if (confirm("Promote this member to Exec Board (admin)?")) {
        update(ref(db, `users/${uid}`), { role: 'admin' });
    }
};

window.demoteUser = (uid) => {
    if (confirm("Demote this admin to member?")) {
        update(ref(db, `users/${uid}`), { role: 'member' });
    }
};

window.removeUser = (uid) => {
    if (confirm("Remove this member from the forum? This cannot be undone.")) {
        remove(ref(db, `users/${uid}`));
    }
};

// ── MODERATION / RECYCLING BIN ────────────────────────────────────────────────

const NODE_LABELS = {
    discussions: 'The Floor',
    perspectives: 'Perspectives',
    features: 'Weekly Feature',
    lessons: 'The Academy'
};

function renderModeration(posts, container) {
    container.innerHTML = `
        <div class="mod-info-bar" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
            <div style="display:flex;align-items:center;gap:8px;">
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                    <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
                ${posts.length} deleted post${posts.length !== 1 ? 's' : ''} — restore or permanently delete below.
            </div>
            <button class="btn-deny" onclick="deleteAllPosts()" style="white-space:nowrap;">
                🗑 Delete All
            </button>
        </div>
        ${posts.map(post => `
            <div class="admin-list-item mod-item">
                <div class="mod-meta">
                    <span class="mod-source">${esc(NODE_LABELS[post._deletedFrom] || post._deletedFrom)}</span>
                    <span class="mod-title">${esc(post.title || post.question) || '(untitled)'}</span>
                    <span class="mod-author">by ${esc(post.author) || '—'}</span>
                    <span class="mod-deleted-by">
                        Deleted by ${esc(post._deletedBy) || '—'} · ${formatDate(post._deletedAt)}
                    </span>
                    ${post.body || post.content
                        ? `<div class="mod-preview">${esc(stripHtml(post.body || post.content || '').substring(0, 120))}${stripHtml(post.body || post.content || '').length > 120 ? '…' : ''}</div>`
                        : ''}
                </div>
                <div class="admin-actions">
                    <button class="btn-approve" onclick="restorePost('${post.id}')">
                        ↩ Restore
                    </button>
                    <button class="btn-deny" onclick="permanentDelete('${post.id}')">
                        🗑 Delete
                    </button>
                </div>
            </div>
        `).join('')}
    `;
}

window.restorePost = async (id) => {
    const snap = await get(ref(db, `deleted_posts/${id}`));
    if (!snap.exists()) return;

    const post = snap.val();
    const { _deletedFrom, _deletedAt, _deletedBy, _deletedById, _originalId, ...originalData } = post;

    if (!_deletedFrom || !_originalId) {
        alert("Cannot restore: missing original location data.");
        return;
    }

    await set(ref(db, `${_deletedFrom}/${_originalId}`), originalData);
    await remove(ref(db, `deleted_posts/${id}`));
};

window.permanentDelete = async (id) => {
    if (confirm("Permanently delete this post? This cannot be undone.")) {
        await remove(ref(db, `deleted_posts/${id}`));
    }
};

window.deleteAllPosts = async () => {
    if (confirm("Permanently delete ALL posts in the recycling bin? This cannot be undone.")) {
        await remove(ref(db, 'deleted_posts'));
    }
};

function formatDate(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

// ── ENGAGEMENT POINTS ──────────────────────────────────────────────────────

let latestUsersObj = {};
let activeRevoke = null;   // { uid, awardId }
let activeCorrect = null;  // { uid, awardId, original }
let activeApprove = null;  // { uid, reqId, request }
let apAcknowledgedOverLimit = false;
let apvAcknowledgedOverLimit = false;

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function showAdminError(el, msg) {
    el.textContent = msg;
    el.style.display = 'block';
}

// Resolved once during the admin check on page load; re-fetched only if that
// somehow hasn't happened yet, so each award/approval isn't paying for an
// extra round trip that can also fail mid-action.
async function getMyAdminName() {
    if (adminIdentity) return adminIdentity;
    const me = auth.currentUser;
    if (!me) throw new Error('You are no longer signed in. Please sign in again.');
    const snap = await get(ref(db, `users/${me.uid}`));
    const data = snap.val() || {};
    adminIdentity = { uid: me.uid, name: data.displayName || me.email };
    return adminIdentity;
}

// Returns a plain-text (not HTML) warning string, or null if no weekly limit
// applies or the limit would not be exceeded.
function getWeeklyLimitWarning(usersObj, uid, activityKey, dateStr) {
    const activity = getActivity(activityKey);
    if (!activity || !activity.weeklyLimit) return null;
    const member = usersObj[uid];
    const existing = countActiveInWeek(member ? member.pointAwards : null, activityKey, dateStr || todayDateStr());
    if (existing >= activity.weeklyLimit) {
        const name = member ? memberDisplayName(member) : 'This member';
        return `${name} already has ${existing} active "${activity.label}" award(s) that week (limit ${activity.weeklyLimit}/week). This would exceed the weekly limit.`;
    }
    return null;
}

function populateActivitySelectEl(selId) {
    const sel = document.getElementById(selId);
    sel.innerHTML = '<option value="">Select an activity…</option>' +
        RUBRIC.map(a => `<option value="${esc(a.key)}">${esc(a.label)}${a.weeklyLimit ? ` (max ${a.weeklyLimit}/week)` : ''}</option>`).join('');
}

function populateOptionSelectEl(activityKey, optSelId, pointsInputId) {
    const sel = document.getElementById(optSelId);
    if (!activityKey) {
        sel.innerHTML = '<option value="">Select an activity first…</option>';
        sel.disabled = true;
        if (pointsInputId) document.getElementById(pointsInputId).value = '';
        return;
    }
    const activity = getActivity(activityKey);
    sel.disabled = false;
    sel.innerHTML = '<option value="">Select a credit level…</option>' +
        activity.options.map(o => `<option value="${esc(o.key)}">${esc(o.label)} (${o.points > 0 ? '+' : ''}${o.points} pts)</option>`).join('');
}

// ── RENDER: POINTS TAB ──────────────────────────────────────────────────────

function renderPointsTab(usersObj, container) {
    latestUsersObj = usersObj;

    let pendingCount = 0;
    Object.values(usersObj).forEach(u => Object.values(u.pointRequests || {}).forEach(r => { if (r.status === 'pending') pendingCount++; }));

    container.innerHTML = `
        <div class="points-subtabs">
            <button class="subtab-btn ${pointsSubTab === 'totals' ? 'active' : ''}" data-sub="totals">Members &amp; Totals</button>
            <button class="subtab-btn ${pointsSubTab === 'awards' ? 'active' : ''}" data-sub="awards">All Awards</button>
            <button class="subtab-btn ${pointsSubTab === 'requests' ? 'active' : ''}" data-sub="requests">Pending Requests (${pendingCount})</button>
        </div>
        <div id="points-subtab-content"></div>
    `;

    container.querySelectorAll('.subtab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            pointsSubTab = btn.dataset.sub;
            renderPointsTab(usersObj, container);
        });
    });

    const subContent = document.getElementById('points-subtab-content');
    if (pointsSubTab === 'totals') renderPointsTotals(usersObj, subContent);
    else if (pointsSubTab === 'awards') renderPointsAwards(usersObj, subContent);
    else renderPointsRequests(usersObj, subContent);
}

function renderPointsTotals(usersObj, container) {
    const totals = rankLeaderboard(computeAllTotals(usersObj));

    // Scoped to approved members only, matching the Members tab's duplicate
    // check — a pending signup that happens to reuse an approved member's
    // email isn't the same kind of problem and would just be noise here.
    const emailCounts = {};
    Object.values(usersObj).forEach(u => {
        if (u && u.email && u.status === 'approved') emailCounts[u.email] = (emailCounts[u.email] || 0) + 1;
    });

    container.innerHTML = `
        <button class="btn-approve" id="openAddPointsBtn" style="margin-bottom:16px;">+ Award Points</button>
        <div class="points-table-wrap">
            <table class="points-table">
                <thead><tr><th>Rank</th><th>Member</th><th>Total Points</th><th></th></tr></thead>
                <tbody>
                    ${totals.length ? totals.map(t => {
                        const email = usersObj[t.uid] && usersObj[t.uid].email;
                        return `<tr>
                            <td>#${t.rank}</td>
                            <td>${esc(t.name)}${email && emailCounts[email] > 1 ? ` <span class="dup-badge" title="Another approved member has this same email — likely a duplicate account.">⚠ duplicate email</span>` : ''}</td>
                            <td>${t.total}</td>
                            <td><button class="btn-approve btn-sm" data-action="give-points" data-uid="${esc(t.uid)}">Give Points</button></td>
                        </tr>`;
                    }).join('') : '<tr><td colspan="4" class="empty-cell">No approved members.</td></tr>'}
                </tbody>
            </table>
        </div>
    `;
    document.getElementById('openAddPointsBtn').addEventListener('click', () => openAddPointsModal());
    container.querySelectorAll('[data-action="give-points"]').forEach(btn =>
        btn.addEventListener('click', () => openAddPointsModal(btn.dataset.uid))
    );
}

function renderPointsAwards(usersObj, container) {
    const rows = [];
    Object.entries(usersObj).forEach(([uid, u]) => {
        Object.entries(u.pointAwards || {}).forEach(([awardId, a]) => rows.push({ uid, awardId, ...a }));
    });
    rows.sort((a, b) => (b.awardedAt || 0) - (a.awardedAt || 0));

    container.innerHTML = rows.length ? `
        <div class="points-table-wrap">
            <table class="points-table">
                <thead><tr><th>Member</th><th>Activity</th><th>Points</th><th>Date</th><th>Awarded By</th><th>Note</th><th>Status</th><th></th></tr></thead>
                <tbody>
                    ${rows.map(r => {
                        // Prefer the CURRENT name of a member who still exists (so a rename
                        // shows up immediately everywhere) and only fall back to the name
                        // stored on the record at award time if that member/admin has since
                        // been removed entirely - the one case that stored snapshot actually
                        // protects against.
                        const memberName = usersObj[r.uid] ? memberDisplayName(usersObj[r.uid]) : (r.memberName || 'Member');
                        const awardedByName = usersObj[r.awardedByUid] ? memberDisplayName(usersObj[r.awardedByUid]) : (r.awardedByName || '—');
                        return `
                        <tr class="${r.revoked ? 'row-revoked' : ''}">
                            <td>${esc(memberName)}</td>
                            <td>${esc(formatOptionLabel(r.activity))}</td>
                            <td>${r.revoked ? '<s>' : ''}${r.points > 0 ? '+' : ''}${r.points}${r.revoked ? '</s>' : ''}</td>
                            <td>${esc(r.activityDate || '—')}</td>
                            <td>${esc(awardedByName)}</td>
                            <td>${esc(r.note || '') || '—'}</td>
                            <td>${r.revoked ? `<span class="status-pill status-pill--revoked">Revoked</span>` : (r.correctionOf ? `<span class="status-pill status-pill--corrected">Correction</span>` : `<span class="status-pill status-pill--approved">Active</span>`)}</td>
                            <td>${!r.revoked ? `
                                <button class="btn-deny btn-sm" data-action="revoke" data-uid="${esc(r.uid)}" data-award="${esc(r.awardId)}">Revoke</button>
                                <button class="btn-approve btn-sm" data-action="correct" data-uid="${esc(r.uid)}" data-award="${esc(r.awardId)}">Correct</button>
                            ` : ''}</td>
                        </tr>
                    `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    ` : `<p class="empty-state">No point awards yet.</p>`;

    container.querySelectorAll('[data-action="revoke"]').forEach(btn => btn.addEventListener('click', () => openRevokeModal(btn.dataset.uid, btn.dataset.award)));
    container.querySelectorAll('[data-action="correct"]').forEach(btn => btn.addEventListener('click', () => openCorrectModal(btn.dataset.uid, btn.dataset.award)));
}

function renderPointsRequests(usersObj, container) {
    const rows = [];
    Object.entries(usersObj).forEach(([uid, u]) => {
        Object.entries(u.pointRequests || {}).forEach(([reqId, r]) => {
            // u is the live user for this uid (we're iterating usersObj directly),
            // so always prefer their current name over whatever was snapshotted
            // onto the request at submission time.
            if (r && r.status === 'pending') rows.push({ uid, reqId, ...r, memberName: memberDisplayName(u) });
        });
    });
    rows.sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));

    const myUid = auth.currentUser ? auth.currentUser.uid : null;
    const visible = rows.filter(r => r.uid !== myUid);
    const ownCount = rows.length - visible.length;

    container.innerHTML = `
        ${ownCount > 0 ? `<p class="empty-state" style="margin-bottom:16px;">You have ${ownCount} pending request${ownCount !== 1 ? 's' : ''} of your own — another Exec Board member must review ${ownCount !== 1 ? 'those' : 'that'}.</p>` : ''}
        ${visible.length ? visible.map(r => {
            const activity = getActivity(r.activity);
            const claimed = r.claimedOptionKey ? getOption(r.claimedOptionKey) : null;
            return `
            <div class="admin-list-item mod-item">
                <div class="mod-meta">
                    <span class="mod-title">${esc(r.memberName)} — ${esc(activity ? activity.label : r.activity)}${claimed ? ` (${esc(claimed.option.label)}, ${claimed.option.points} pts claimed)` : ''}</span>
                    <span class="mod-author">Activity date: ${esc(r.activityDate || '—')} · Submitted ${formatDate(r.submittedAt)}</span>
                    <div class="mod-preview">${esc(r.description || '')}</div>
                    ${r.evidenceUrl ? `<div><a href="${esc(r.evidenceUrl)}" target="_blank" rel="noopener">View evidence (${esc(r.evidenceFileName || 'file')})</a></div>` : ''}
                </div>
                <div class="admin-actions">
                    <button class="btn-approve" data-action="approve" data-uid="${esc(r.uid)}" data-req="${esc(r.reqId)}">Approve</button>
                    <button class="btn-deny" data-action="reject" data-uid="${esc(r.uid)}" data-req="${esc(r.reqId)}">Reject</button>
                </div>
            </div>`;
        }).join('') : `<p class="empty-state">No pending requests${ownCount > 0 ? ' from other members' : ''}.</p>`}
    `;

    container.querySelectorAll('[data-action="approve"]').forEach(btn => btn.addEventListener('click', () => openApproveModal(btn.dataset.uid, btn.dataset.req)));
    container.querySelectorAll('[data-action="reject"]').forEach(btn => btn.addEventListener('click', () => rejectRequest(btn.dataset.uid, btn.dataset.req)));
}

// ── ADD POINTS ───────────────────────────────────────────────────────────

// preselectUid: when given (e.g. from a "Give Points" button on a specific
// member's row), that member is chosen automatically instead of making the
// admin find them again in the dropdown.
function openAddPointsModal(preselectUid) {
    apAcknowledgedOverLimit = false;
    const memberSel = document.getElementById('apMember');
    // Must match the exact same "approved" definition used everywhere else
    // (the Members tab, the leaderboard) — otherwise this dropdown, the
    // leaderboard, and the admin member list can each show a different set
    // of people for the same underlying data.
    memberSel.innerHTML = Object.entries(latestUsersObj)
        .filter(([, u]) => u && u.status === 'approved')
        .sort((a, b) => memberDisplayName(a[1]).localeCompare(memberDisplayName(b[1])))
        .map(([uid, u]) => `<option value="${esc(uid)}">${esc(memberDisplayName(u))}</option>`).join('');

    if (preselectUid && latestUsersObj[preselectUid]) {
        memberSel.value = preselectUid;
    }

    populateActivitySelectEl('apActivity');
    document.getElementById('apActivity').value = '';
    populateOptionSelectEl(null, 'apOption', 'apPoints');
    const apDate = document.getElementById('apDate');
    apDate.value = todayDateStr();
    apDate.max = todayDateStr();
    apDate.min = MIN_ACTIVITY_DATE;
    document.getElementById('apNote').value = '';
    document.getElementById('apError').style.display = 'none';
    document.getElementById('apLimitWarning').style.display = 'none';
    document.getElementById('apConfirmBtn').textContent = 'Add Points';

    openModal('addPointsModal');
}

async function submitAddPoints() {
    const memberUid = document.getElementById('apMember').value;
    const activityKey = document.getElementById('apActivity').value;
    const optionKey = document.getElementById('apOption').value;
    const activityDate = document.getElementById('apDate').value;
    const note = document.getElementById('apNote').value.trim();
    const errEl = document.getElementById('apError');
    errEl.style.display = 'none';

    if (!memberUid || !latestUsersObj[memberUid]) { return showAdminError(errEl, 'Please select a member.'); }

    const selection = resolveSelection(activityKey, optionKey);
    if (selection.error) return showAdminError(errEl, selection.error);

    // An empty points field parses as 0, which would silently award nothing
    // instead of surfacing the mistake.
    const parsedPoints = parsePointsValue(document.getElementById('apPoints').value);
    if (parsedPoints.error) return showAdminError(errEl, parsedPoints.error);
    const pointsVal = parsedPoints.value;

    const dateError = validateActivityDate(activityDate);
    if (dateError) return showAdminError(errEl, dateError);

    const warning = getWeeklyLimitWarning(latestUsersObj, memberUid, activityKey, activityDate);
    if (warning && !apAcknowledgedOverLimit) {
        document.getElementById('apLimitWarning').textContent = warning + ' Click "Add Anyway" to proceed.';
        document.getElementById('apLimitWarning').style.display = 'block';
        document.getElementById('apConfirmBtn').textContent = 'Add Anyway';
        apAcknowledgedOverLimit = true;
        return;
    }

    const btn = document.getElementById('apConfirmBtn');
    btn.disabled = true;
    try {
        const me = await getMyAdminName();
        const member = latestUsersObj[memberUid];

        await set(push(ref(db, `users/${memberUid}/pointAwards`)), {
            memberId: memberUid,
            memberName: memberDisplayName(member),
            activity: optionKey,
            points: pointsVal,
            activityDate,
            awardedAt: Date.now(),
            awardedByUid: me.uid,
            awardedByName: me.name,
            source: 'direct',
            requestId: null,
            note,
            revoked: false,
            correctionOf: null
        });

        closeModal('addPointsModal');
        showToast(`Awarded ${pointsVal} point${pointsVal === 1 ? '' : 's'} to ${memberDisplayName(member)}.`, 'success');
    } catch (err) {
        console.error(err);
        showAdminError(errEl, 'Failed to add points: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Add Points';
    }
}

// ── REVOKE AWARD ─────────────────────────────────────────────────────────

function openRevokeModal(uid, awardId) {
    const member = latestUsersObj[uid];
    const award = member && member.pointAwards ? member.pointAwards[awardId] : null;
    if (!award) return;
    activeRevoke = { uid, awardId };
    document.getElementById('revokeSummary').textContent =
        `${memberDisplayName(member)} — ${formatOptionLabel(award.activity)} (${award.points > 0 ? '+' : ''}${award.points} pts, ${award.activityDate || 'no date'})`;
    document.getElementById('revokeReason').value = '';
    document.getElementById('revokeError').style.display = 'none';
    openModal('revokeModal');
}

async function submitRevoke() {
    if (!activeRevoke) return;
    const reason = document.getElementById('revokeReason').value.trim();
    const errEl = document.getElementById('revokeError');
    if (!reason) return showAdminError(errEl, 'Please provide a reason.');

    const btn = document.getElementById('revokeConfirmBtn');
    btn.disabled = true;
    try {
        const me = await getMyAdminName();
        const awardPath = `users/${activeRevoke.uid}/pointAwards/${activeRevoke.awardId}`;

        // Re-read before writing: another exec may have revoked this award from
        // their own tab while this modal sat open.
        const fresh = (await get(ref(db, awardPath))).val();
        if (!fresh) {
            showAdminError(errEl, 'That award no longer exists.');
            return;
        }
        if (fresh.revoked) {
            closeModal('revokeModal');
            activeRevoke = null;
            showToast('That award was already revoked.', 'error');
            return;
        }

        await update(ref(db, awardPath), {
            revoked: true,
            revokedByUid: me.uid,
            revokedByName: me.name,
            revokedAt: Date.now(),
            revocationReason: reason
        });
        closeModal('revokeModal');
        activeRevoke = null;
        showToast('Award revoked. The original record is preserved.', 'success');
    } catch (err) {
        console.error(err);
        showAdminError(errEl, 'Failed to revoke: ' + err.message);
    } finally {
        btn.disabled = false;
    }
}

// ── CORRECT AWARD ────────────────────────────────────────────────────────

function openCorrectModal(uid, awardId) {
    const member = latestUsersObj[uid];
    const award = member && member.pointAwards ? member.pointAwards[awardId] : null;
    if (!award) return;
    activeCorrect = { uid, awardId, original: award };

    document.getElementById('correctSummary').innerHTML =
        `Correcting <strong>${esc(memberDisplayName(member))}</strong>'s award: ${esc(formatOptionLabel(award.activity))} (${award.points > 0 ? '+' : ''}${award.points} pts). The original will be preserved and marked as corrected — nothing is deleted.`;

    populateActivitySelectEl('ctActivity');
    const found = getOption(award.activity);
    const activityKey = found ? found.activity.key : '';
    document.getElementById('ctActivity').value = activityKey;
    populateOptionSelectEl(activityKey || null, 'ctOption', 'ctPoints');
    document.getElementById('ctOption').value = award.activity;
    document.getElementById('ctPoints').value = award.points;
    document.getElementById('ctReason').value = '';
    document.getElementById('correctError').style.display = 'none';
    openModal('correctModal');
}

async function submitCorrect() {
    if (!activeCorrect) return;
    const activityKey = document.getElementById('ctActivity').value;
    const optionKey = document.getElementById('ctOption').value;
    const reason = document.getElementById('ctReason').value.trim();
    const errEl = document.getElementById('correctError');
    errEl.style.display = 'none';

    const selection = resolveSelection(activityKey, optionKey);
    if (selection.error) return showAdminError(errEl, selection.error);

    const parsedPoints = parsePointsValue(document.getElementById('ctPoints').value);
    if (parsedPoints.error) return showAdminError(errEl, parsedPoints.error);
    const pointsVal = parsedPoints.value;

    if (!reason) return showAdminError(errEl, 'Please provide a reason for the correction.');

    const btn = document.getElementById('correctConfirmBtn');
    btn.disabled = true;
    try {
        const me = await getMyAdminName();
        const { uid, awardId } = activeCorrect;
        const member = latestUsersObj[uid];

        const original = (await get(ref(db, `users/${uid}/pointAwards/${awardId}`))).val();
        if (!original) {
            showAdminError(errEl, 'That award no longer exists.');
            return;
        }
        if (original.revoked) {
            closeModal('correctModal');
            activeCorrect = null;
            showToast('That award was already revoked or corrected.', 'error');
            return;
        }

        // Both halves of a correction go in as one atomic multi-path update.
        // Done as two sequential writes, a failure in between would leave the
        // original revoked with no replacement — the member would silently
        // lose the points entirely.
        const replacementKey = push(ref(db, `users/${uid}/pointAwards`)).key;
        const updates = {};
        updates[`users/${uid}/pointAwards/${awardId}/revoked`] = true;
        updates[`users/${uid}/pointAwards/${awardId}/revokedByUid`] = me.uid;
        updates[`users/${uid}/pointAwards/${awardId}/revokedByName`] = me.name;
        updates[`users/${uid}/pointAwards/${awardId}/revokedAt`] = Date.now();
        updates[`users/${uid}/pointAwards/${awardId}/revocationReason`] = `Corrected: ${reason}`;
        updates[`users/${uid}/pointAwards/${replacementKey}`] = {
            memberId: uid,
            memberName: original.memberName || memberDisplayName(member),
            activity: optionKey,
            points: pointsVal,
            activityDate: original.activityDate || todayDateStr(),
            awardedAt: Date.now(),
            awardedByUid: me.uid,
            awardedByName: me.name,
            source: original.source || 'direct',
            requestId: original.requestId || null,
            note: reason,
            revoked: false,
            correctionOf: awardId
        };
        await update(ref(db), updates);

        closeModal('correctModal');
        activeCorrect = null;
        showToast('Correction saved. The original award is preserved in the history.', 'success');
    } catch (err) {
        console.error(err);
        showAdminError(errEl, 'Failed to save correction: ' + err.message);
    } finally {
        btn.disabled = false;
    }
}

// ── APPROVE / REJECT REQUESTS ────────────────────────────────────────────

function openApproveModal(uid, reqId) {
    const member = latestUsersObj[uid];
    const request = member && member.pointRequests ? member.pointRequests[reqId] : null;
    if (!request) return;
    activeApprove = { uid, reqId, request };
    apvAcknowledgedOverLimit = false;

    const activity = getActivity(request.activity);
    document.getElementById('approveSummary').innerHTML =
        `${esc(memberDisplayName(member))} requested credit for <strong>${esc(activity ? activity.label : request.activity)}</strong> on ${esc(request.activityDate || '—')}.<br>"${esc(request.description || '')}"`;

    populateActivitySelectEl('apvActivity');
    document.getElementById('apvActivity').value = request.activity || '';
    populateOptionSelectEl(request.activity || null, 'apvOption', 'apvPoints');
    if (request.claimedOptionKey) {
        document.getElementById('apvOption').value = request.claimedOptionKey;
        const found = getOption(request.claimedOptionKey);
        document.getElementById('apvPoints').value = found ? found.option.points : '';
    }
    document.getElementById('apvNote').value = '';
    document.getElementById('approveError').style.display = 'none';
    document.getElementById('apvLimitWarning').style.display = 'none';
    document.getElementById('approveConfirmBtn').textContent = 'Approve & Award Points';
    openModal('approveModal');
}

async function submitApprove() {
    if (!activeApprove) return;
    const { uid, reqId, request } = activeApprove;
    const activityKey = document.getElementById('apvActivity').value;
    const optionKey = document.getElementById('apvOption').value;
    const note = document.getElementById('apvNote').value.trim();
    const errEl = document.getElementById('approveError');
    errEl.style.display = 'none';

    const selection = resolveSelection(activityKey, optionKey);
    if (selection.error) return showAdminError(errEl, selection.error);

    const parsedPoints = parsePointsValue(document.getElementById('apvPoints').value);
    if (parsedPoints.error) return showAdminError(errEl, parsedPoints.error);
    const pointsVal = parsedPoints.value;

    const warning = getWeeklyLimitWarning(latestUsersObj, uid, activityKey, request.activityDate);
    if (warning && !apvAcknowledgedOverLimit) {
        document.getElementById('apvLimitWarning').textContent = warning + ' Click "Approve Anyway" to proceed.';
        document.getElementById('apvLimitWarning').style.display = 'block';
        document.getElementById('approveConfirmBtn').textContent = 'Approve Anyway';
        apvAcknowledgedOverLimit = true;
        return;
    }

    const btn = document.getElementById('approveConfirmBtn');
    btn.disabled = true;
    try {
        const me = await getMyAdminName();
        const member = latestUsersObj[uid];

        // Re-read the request immediately before writing. Without this, two
        // execs reviewing the same queue (or one with a stale tab) could each
        // approve it and award the points twice.
        const fresh = (await get(ref(db, `users/${uid}/pointRequests/${reqId}`))).val();
        if (!fresh) {
            showAdminError(errEl, 'That request no longer exists.');
            return;
        }
        if (fresh.status !== 'pending') {
            closeModal('approveModal');
            activeApprove = null;
            showToast(`That request was already ${fresh.status}.`, 'error');
            return;
        }

        // The award and the request's status change commit together or not at
        // all. Written separately, a failure after the award landed would leave
        // the request pending and invite a second, duplicate approval.
        const awardKey = push(ref(db, `users/${uid}/pointAwards`)).key;
        const reqPath = `users/${uid}/pointRequests/${reqId}`;
        const updates = {};
        updates[`users/${uid}/pointAwards/${awardKey}`] = {
            memberId: uid,
            memberName: memberDisplayName(member),
            activity: optionKey,
            points: pointsVal,
            activityDate: fresh.activityDate || todayDateStr(),
            awardedAt: Date.now(),
            awardedByUid: me.uid,
            awardedByName: me.name,
            source: 'request',
            requestId: reqId,
            note,
            revoked: false,
            correctionOf: null
        };
        updates[`${reqPath}/status`] = 'approved';
        updates[`${reqPath}/reviewedByUid`] = me.uid;
        updates[`${reqPath}/reviewedByName`] = me.name;
        updates[`${reqPath}/reviewedAt`] = Date.now();
        updates[`${reqPath}/adminNote`] = note;
        updates[`${reqPath}/resultAwardId`] = awardKey;
        await update(ref(db), updates);

        closeModal('approveModal');
        activeApprove = null;
        showToast(`Approved — ${pointsVal} point${pointsVal === 1 ? '' : 's'} awarded to ${memberDisplayName(member)}.`, 'success');
    } catch (err) {
        console.error(err);
        showAdminError(errEl, 'Failed to approve: ' + err.message);
    } finally {
        btn.disabled = false;
    }
}

async function rejectRequest(uid, reqId) {
    const note = prompt('Reason for rejecting this request (optional):', '');
    if (note === null) return; // cancelled
    try {
        const me = await getMyAdminName();

        const fresh = (await get(ref(db, `users/${uid}/pointRequests/${reqId}`))).val();
        if (!fresh) { showToast('That request no longer exists.', 'error'); return; }
        if (fresh.status !== 'pending') {
            showToast(`That request was already ${fresh.status}.`, 'error');
            return;
        }

        await update(ref(db, `users/${uid}/pointRequests/${reqId}`), {
            status: 'rejected',
            reviewedByUid: me.uid,
            reviewedByName: me.name,
            reviewedAt: Date.now(),
            adminNote: note.trim()
        });
        showToast('Request rejected. No points were awarded.', 'success');
    } catch (err) {
        console.error(err);
        showToast('Failed to reject request: ' + err.message, 'error');
    }
}

// ── MODAL WIRING (static elements, wired once) ───────────────────────────

function wirePointsModals() {
    document.getElementById('closeAddPointsModal').addEventListener('click', () => closeModal('addPointsModal'));
    document.getElementById('closeRevokeModal').addEventListener('click', () => closeModal('revokeModal'));
    document.getElementById('closeCorrectModal').addEventListener('click', () => closeModal('correctModal'));
    document.getElementById('closeApproveModal').addEventListener('click', () => closeModal('approveModal'));
    document.querySelectorAll('.modal-overlay').forEach(o =>
        o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); })
    );

    document.getElementById('apActivity').addEventListener('change', (e) => {
        populateOptionSelectEl(e.target.value || null, 'apOption', 'apPoints');
        apAcknowledgedOverLimit = false;
        document.getElementById('apLimitWarning').style.display = 'none';
        document.getElementById('apConfirmBtn').textContent = 'Add Points';
    });
    document.getElementById('apOption').addEventListener('change', (e) => {
        const found = e.target.value ? getOption(e.target.value) : null;
        document.getElementById('apPoints').value = found ? found.option.points : '';
    });
    document.getElementById('apMember').addEventListener('change', () => {
        apAcknowledgedOverLimit = false;
        document.getElementById('apLimitWarning').style.display = 'none';
        document.getElementById('apConfirmBtn').textContent = 'Add Points';
    });
    document.getElementById('apDate').addEventListener('change', () => {
        apAcknowledgedOverLimit = false;
        document.getElementById('apLimitWarning').style.display = 'none';
        document.getElementById('apConfirmBtn').textContent = 'Add Points';
    });
    document.getElementById('apConfirmBtn').addEventListener('click', submitAddPoints);

    document.getElementById('ctActivity').addEventListener('change', (e) => populateOptionSelectEl(e.target.value || null, 'ctOption', 'ctPoints'));
    document.getElementById('ctOption').addEventListener('change', (e) => {
        const found = e.target.value ? getOption(e.target.value) : null;
        document.getElementById('ctPoints').value = found ? found.option.points : '';
    });
    document.getElementById('correctConfirmBtn').addEventListener('click', submitCorrect);
    document.getElementById('revokeConfirmBtn').addEventListener('click', submitRevoke);

    document.getElementById('apvActivity').addEventListener('change', (e) => {
        populateOptionSelectEl(e.target.value || null, 'apvOption', 'apvPoints');
        apvAcknowledgedOverLimit = false;
        document.getElementById('apvLimitWarning').style.display = 'none';
        document.getElementById('approveConfirmBtn').textContent = 'Approve & Award Points';
    });
    document.getElementById('apvOption').addEventListener('change', (e) => {
        const found = e.target.value ? getOption(e.target.value) : null;
        document.getElementById('apvPoints').value = found ? found.option.points : '';
    });
    document.getElementById('approveConfirmBtn').addEventListener('click', submitApprove);
}
wirePointsModals();
// loadData() is kicked off by the admin check in onAuthStateChanged above,
// not here — see the comment there.