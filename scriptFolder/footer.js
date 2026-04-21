class SpecialFooter extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
        <footer>
      <div class="footer-brand">
        <div class="name">THE ECONOMIC FORUM</div>
        <div class="sub">Watchung Hills Regional High School</div>
      </div>
      <div class="footer-social">
        <a href="#" class="social-btn"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"
            viewBox="0 0 24 24">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
          </svg></a>
        <a href="https://www.youtube.com/@TheEconomicForum_TEF" class="social-btn"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"
            viewBox="0 0 24 24">
            <path
              d="M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 00-1.95 1.96A29 29 0 001 12a29 29 0 00.46 5.58A2.78 2.78 0 003.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 001.95-1.95A29 29 0 0023 12a29 29 0 00-.46-5.58z" />
            <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="currentColor" stroke="none" />
          </svg></a>
        <a href="mailto:contact@theeconomicforum.org" class="social-btn"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"
            viewBox="0 0 24 24">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg></a>
      </div>
    </footer>
    <div class="footer-bottom">
      <span class="footer-copy">© 2026 The Economic Forum. All rights reserved.</span>
      <span class="footer-disc">Not affiliated with WHRHS</span>
    </div>
        `;
    }
}

customElements.define('tef-footer', SpecialFooter);