import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, onValue, update, remove } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";
import { firebaseConfig } from './config.js';

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
    const content = document.getElementById('tab-content');
    const pendingCount = document.getElementById('count-pending');

    // Show a loading message immediately when switching tabs
    content.innerHTML = `<p class="empty-state">Fetching data from the Forum...</p>`;

    onValue(usersRef, (snapshot) => {
        const data = snapshot.val();
        
        if (!data) {
            pendingCount.innerText = "0";
            content.innerHTML = `<p class="empty-state">No records found in the database.</p>`;
            return;
        }

        const userArray = Object.entries(data).map(([id, val]) => ({ id, ...val }));
        
        // Filter pending users
        const pending = userArray.filter(u => u.status === 'pending');
        pendingCount.innerText = pending.length;

        if (currentTab === 'approvals') {
            renderApprovals(pending, content);
        } else if (currentTab === 'members') {
            renderMembers(userArray.filter(u => u.status === 'approved'), content);
        } else {
            content.innerHTML = `<p class="empty-state">No pending moderation flags.</p>`;
        }
    }, (error) => {
        // This part triggers if your Security Rules block the Admin's access
        console.error("Firebase Read Error:", error);
        content.innerHTML = `
            <div class="empty-state" style="color: #ff4d4d; border: 1px solid #ff4d4d; padding: 20px; border-radius: 8px;">
                <p><strong>Access Denied</strong></p>
                <p>The database refused to load user records. Ensure your account is set to 'admin' in the database.</p>
                <small>${error.message}</small>
            </div>`;
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