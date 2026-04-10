import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, onValue, update, remove } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";
import { firebaseConfig } from './app.js';

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let currentTab = 'approvals';

export function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    loadData();
}
window.switchTab = switchTab; // Make it global for the HTML

function loadData() {
    const usersRef = ref(db, 'users');
    onValue(usersRef, (snapshot) => {
        const data = snapshot.val();
        const content = document.getElementById('tab-content');
        const pendingCount = document.getElementById('count-pending');
        
        if (!data) {
            content.innerHTML = `<p class="empty-state">No records found.</p>`;
            return;
        }

        const userArray = Object.entries(data).map(([id, val]) => ({ id, ...val }));
        const pending = userArray.filter(u => u.status === 'pending');
        pendingCount.innerText = pending.length;

        if (currentTab === 'approvals') {
            renderApprovals(pending, content);
        } else if (currentTab === 'members') {
            renderMembers(userArray.filter(u => u.status === 'approved'), content);
        } else {
            content.innerHTML = `<p class="empty-state">No pending moderation flags.</p>`;
        }
    });
}

function renderApprovals(list, container) {
    if (list.length === 0) {
        container.innerHTML = `<p class="empty-state">No pending approvals.</p>`;
        return;
    }
    container.innerHTML = list.map(user => `
        <div class="admin-list-item">
            <span class="user-info">${user.email}</span>
            <div class="admin-actions">
                <button class="btn-approve" onclick="updateStatus('${user.id}', 'approved')">Approve</button>
                <button class="btn-deny" onclick="deleteUser('${user.id}')">Deny</button>
            </div>
        </div>
    `).join('');
}

window.updateStatus = (uid, status) => {
    update(ref(db, `users/${uid}`), { status: status });
};

window.deleteUser = (uid) => {
    if(confirm("Are you sure you want to deny this request?")) {
        remove(ref(db, `users/${uid}`));
    }
};

// Initial Load
loadData();