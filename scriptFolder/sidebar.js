// 1. Import 'app' from your config file
import { app } from './app.js';
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";

// 2. Pass 'app' into the getters
const auth = getAuth(app);
window.auth = auth;
const db = getDatabase(app);

class SpecialSidebar extends HTMLElement {
    async connectedCallback() {
        const active = this.getAttribute('active-page') || 'nexus';

        this.innerHTML = `

        
        <aside class="sidebar">

        <div class="sidebar-logo" onclick="window.location.href='index.html'" style="cursor:pointer">
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
        Home
    </a>

    <a class="nav-item ${active === 'trading' ? 'active' : ''}" href="trading-floor.html">
    <span class="nav-icon">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
            <path d="M11.5 5.5H12.5" /> <path d="M6 8V6.5C6 4.567 7.567 3 9.5 3H14.5C16.433 3 18 4.567 18 6.5V8C20.2091 8 22 9.79086 22 12V17C22 19.2091 20.2091 21 18 21H16C13.7909 21 12 19.2091 12 17V15H12V17C12 19.2091 10.2091 21 8 21H6C3.79086 21 2 19.2091 2 17V12C2 9.79086 3.79086 8 6 8Z" />
            <path d="M7 11.5V14.5" />
            <path d="M5.5 13H8.5" />
            <path d="M16.5 11V11" stroke-width="2.5" /> <path d="M16.5 15V15" stroke-width="2.5" /> <path d="M18.5 13V13" stroke-width="2.5" /> <path d="M14.5 13V13" stroke-width="2.5" /> </svg>
    </span>
    Game Hub
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

            <div class="sidebar-footer" id="sidebar-footer-content">
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
            const footerContent = this.querySelector('#sidebar-footer-content');
            const execSection = this.querySelector('#exec-section');

            if (user) {
                const snapshot = await get(ref(db, 'users/' + user.uid));
                const data = snapshot.val();

                if (data) {
                    // Admin logic
                    if (execSection) {
                        execSection.style.display = data.role === "admin" ? "block" : "none";
                    }

                    // Render Profile View
                    const initials = data.email.substring(0, 2).toUpperCase();
                    const displayName = data.email.split('@')[0];
                    const displayRole = data.role.toUpperCase();

                    footerContent.innerHTML = `
                    <div class="user-profile-block" style="display: flex; align-items: center; gap: 12px;">
                        <div class="avatar-circle" style="width: 36px; height: 36px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-family: 'Space Mono', monospace; font-size: 12px;">
                            ${initials}
                        </div>
                        <div class="user-info">
                            <div style="font-weight: 700; color: #fff; font-size: 14px;">${displayName}</div>
                            <div style="font-family: 'Space Mono', monospace; font-size: 11px; color: var(--gold);">${displayRole}</div>
                            
                        </div>
                        <button onclick="auth.signOut()" class="logout-btn" title="Sign Out" style="background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 5px; display: flex; align-items: center; justify-content: center; transition: color 0.2s;">
                            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"></path>
                            </svg>
                        </button>
                    </div>
                `;
                }
            } else {
                // LOGGED OUT: Show Big Sign In Button
                if (execSection) execSection.style.display = "none";

                footerContent.innerHTML = `
                <button class="sidebar-signin-btn" onclick="window.location.href='auth.html'" style="
                    width: 100%;
                    background: var(--gold);
                    color: #0c1221;
                    border: none;
                    padding: 12px;
                    border-radius: 4px;
                    font-family: 'Space Mono', monospace;
                    font-weight: 700;
                    font-size: 13px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    transition: opacity 0.2s;
                ">
                    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4m-7-7l5-5m-5 5l5 5m-5-5h12" />
                    </svg>
                    SIGN IN
                </button>
            `;
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