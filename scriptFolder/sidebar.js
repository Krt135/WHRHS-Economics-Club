// 1. Import 'app' from your config file
import { app } from './app.js';
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";

// 2. Pass 'app' into the getters
const auth = getAuth(app);
const db = getDatabase(app);

class SpecialSidebar extends HTMLElement {
    async connectedCallback() {
        const active = this.getAttribute('active-page') || 'nexus';

        this.innerHTML = `

        
        <aside class="sidebar">

        <div class="sidebar-logo">
                <img class="logo-icon" src="images/TEF-image.jpeg" alt="Logo">
                <div class="logo-text">
                    <span class="top">THE ECONOMIC</span>
                    <span class="bot">FORUM</span>
                </div>
            </div>

            <nav class="sidebar-nav">
    <div class="nav-section-label">MAIN</div>
    
    <a class="nav-item ${active === 'nexus' ? 'active' : ''}" href="index.html">
        <span class="nav-icon">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
        </span>
        The Nexus
    </a>

    <a class="nav-item ${active === 'trading' ? 'active' : ''}" href="trading-floor.html">
        <span class="nav-icon">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <polyline points="8 21 12 17 16 21" />
            </svg>
        </span>
        Trading Floor
    </a>

    <a class="nav-item ${active === 'about' ? 'active' : ''}" href="about-us.html">
        <span class="nav-icon">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
        </span>
        About Us
    </a>

    <div class="nav-section-label" style="margin-top:14px;">FORUM SUITE</div>

<a class="nav-item ${active === 'floor' ? 'active' : ''}" href="the-floor.html">
    <span class="nav-icon">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
    </span>
    The Floor
</a>

<a class="nav-item ${active === 'weekly' ? 'active' : ''}" href="weekly-feature.html">
    <span class="nav-icon">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
    </span>
    Weekly Feature
</a>

<a class="nav-item ${active === 'perspectives' ? 'active' : ''}" href="perspectives.html">
    <span class="nav-icon">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
    </span>
    Perspectives
</a>

<a class="nav-item ${active === 'academy' ? 'active' : ''}" href="the-academy.html">
    <span class="nav-icon">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 10L12 5L2 10L12 15L22 10Z" /><path d="M6 12V17C9 19 15 19 18 17V12" /></svg>
    </span>
    The Academy
</a>

<a class="nav-item ${active === 'bulletin' ? 'active' : ''}" href="bulletin.html">
    <span class="nav-icon">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 5L6 9H2V15H6L11 19V5Z" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></svg>
    </span>
    The Bulletin
</a>

<div id="exec-section" style="display: none; margin-top: 14px;">
    <div class="nav-section-label">EXEC BOARD</div>
    <a class="nav-item ${active === 'admin' ? 'active' : ''}" href="admin.html">
        <span class="nav-icon">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
        </span>
        Admin Panel
    </a>
</div>
</nav>

            <div class="sidebar-footer">
                <div class="user-info" onclick="handleLogout()" style="cursor:pointer">
                    <div class="avatar" id="user-avatar">??</div>
                    <div>
                        <div class="user-name" id="user-display-name">Guest</div>
                        <div class="user-role" id="user-display-role">Public</div>
                    </div>
                </div>
            </div>
        </aside>
        `;

        // Check Auth Status specifically for this sidebar instance
        this.checkAccess();
    }

    async checkAccess() {
    onAuthStateChanged(auth, async (user) => {
        const avatar = this.querySelector('#user-avatar');
        const nameLabel = this.querySelector('#user-display-name');
        const roleLabel = this.querySelector('#user-display-role');

        if (user) {
            const snapshot = await get(ref(db, 'users/' + user.uid));
            const data = snapshot.val();
            
            if (data) {
                // SUCCESS: User recognized
                if (data.role === "admin") {
                    this.querySelector('#exec-section').style.display = "block";
                }
                avatar.innerText = data.email.substring(0,2).toUpperCase();
                nameLabel.innerText = data.email.split('@')[0];
                roleLabel.innerText = data.role.toUpperCase();
            } else {
                // ERROR: Logged in but no database entry found
                nameLabel.innerText = "Unknown User";
                roleLabel.innerText = "No Role Assigned";
            }
        } else {
            // LOGGED OUT: Default state
            this.querySelector('#exec-section').style.display = "none";
            avatar.innerText = "??";
            nameLabel.innerText = "Guest";
            roleLabel.innerText = "Public";
        }
    });
}
}

// Define the element
customElements.define('tef-sidebar', SpecialSidebar);

// Global Logout Function
window.handleLogout = () => {
    if (confirm("Do you want to sign out?")) {
        signOut(auth).then(() => {
            window.location.href = "auth.html";
        });
    }
};