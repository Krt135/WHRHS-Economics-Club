import { app } from './app.js';
import { getDatabase, ref, onValue, update, remove, get, set } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { profileAvatarHtml } from "./profile-link.js";


const db = getDatabase(app);
const auth = getAuth(app);

let currentTab = 'approvals';
let unsubscribe = null;

export function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
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

            const userArray = Object.entries(data).map(([id, val]) => ({ id, ...val }));
            const pending = userArray.filter(u => u.status === 'pending');
            pendingCount.innerText = pending.length;

            if (currentTab === 'approvals') {
                renderApprovals(pending, content);
            } else {
                renderMembers(userArray.filter(u => u.status === 'approved'), content);
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
                <div class="member-avatar">${(user.displayName || user.email).substring(0,2).toUpperCase()}</div>
                <div>
                    <div class="member-name">${user.displayName || '—'}</div>
                    <div class="member-email">${user.email}</div>
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

function renderMembers(list, container) {
    if (list.length === 0) {
        container.innerHTML = `<p class="empty-state">No approved members found.</p>`;
        return;
    }

    const admins = list.filter(u => u.role === 'admin');
    const members = list.filter(u => u.role !== 'admin');

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
                            (user.displayName || user.email).substring(0,2).toUpperCase(), 
                            { stopPropagation: true, role: user.role || 'member' }
                        )}
                        <div>
                            <div class="member-name">
                                ${profileAvatarHtml(
                                    user.id,
                                    "span",
                                    "profile-link-name",
                                    "cursor: pointer;",
                                    user.displayName || '—',
                                    { stopPropagation: true, role: user.role || 'member' }
                                )}
                                <span class="role-pill role-pill--${user.role}">${user.role.toUpperCase()}</span>
                            </div>
                            <div class="member-email">${user.email}</div>
                            ${user.secondaryEmail ? `<div class="member-email member-secondary">${user.secondaryEmail}</div>` : ''}
                            ${user.bio ? `<div class="member-bio">${user.bio}</div>` : ''}
                        </div>
                    </div>
                    <div class="admin-actions">
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

    container.innerHTML = `
        <div class="members-search-wrap">
            <input class="members-search" type="text" placeholder="Search members…" oninput="filterMembers(this.value)" />
        </div>
        <div id="members-list">
            ${renderGroup(admins, 'EXEC BOARD')}
            ${renderGroup(members, 'MEMBERS')}
        </div>
    `;
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
                    <span class="mod-source">${NODE_LABELS[post._deletedFrom] || post._deletedFrom}</span>
                    <span class="mod-title">${post.title || post.question || '(untitled)'}</span>
                    <span class="mod-author">by ${post.author || '—'}</span>
                    <span class="mod-deleted-by">
                        Deleted by ${post._deletedBy || '—'} · ${formatDate(post._deletedAt)}
                    </span>
                    ${post.body || post.content
                        ? `<div class="mod-preview">${(post.body || post.content || '').substring(0, 120)}${(post.body || post.content || '').length > 120 ? '…' : ''}</div>`
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

// Initial load
loadData();