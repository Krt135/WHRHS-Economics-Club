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
                <div class="logo-icon">TEF</div>
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
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
        </span>
        The Floor
    </a>

    <a class="nav-item ${active === 'weekly' ? 'active' : ''}" href="weekly-feature.html">
        <span class="nav-icon">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
            </svg>
        </span>
        Weekly Feature
    </a>

    <a class="nav-item ${active === 'perspectives' ? 'active' : ''}" href="perspectives.html">
        <span class="nav-icon">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
        </span>
        Perspectives
    </a>

    <a class="nav-item ${active === 'academy' ? 'active' : ''}" href="the-academy.html">The Academy</a>

    <div class="nav-section-label">Exec Panel</div>
    
    <a class="nav-item ${active === 'bulletin' ? 'active' : ''}" href="admin.html">The Bulletin</a>
    
    <div id="exec-section" style="display: none;">
        <div class="nav-section-label" style="margin-top:14px;">EXEC BOARD</div>
        <a class="nav-item ${active === 'admin' ? 'active' : ''}" href="admin.html">Admin Panel</a>
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
            if (user) {
                const snapshot = await get(ref(db, 'users/' + user.uid));
                const data = snapshot.val();
                
                if (data) {
                    // Show Admin Panel if admin
                    if (data.role === "admin") {
                        const execSection = this.querySelector('#exec-section');
                        if (execSection) execSection.style.display = "block";
                    }

                    // Update Footer UI
                    this.querySelector('#user-avatar').innerText = data.email.substring(0,2).toUpperCase();
                    this.querySelector('#user-display-name').innerText = data.email.split('@')[0];
                    this.querySelector('#user-display-role').innerText = data.role.toUpperCase();
                }
            }
        });
    }
}

// Define the element
customElements.define('tef-sidebar', SpecialSidebar);

// Global Logout Function
window.handleLogout = () => {
    if(confirm("Do you want to sign out?")) {
        signOut(auth).then(() => {
            window.location.href = "auth.html";
        });
    }
};