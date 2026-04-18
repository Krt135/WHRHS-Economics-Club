import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
    import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
    import { getDatabase, ref, get, update } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";
    import { firebaseConfig } from './config.js';
 
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getDatabase(app);
 
    // ── Auth guard ────────────────────────────────────────────────────────
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "/login.html";
        return;
      }
 
      const snap = await get(ref(db, `users/${user.uid}`));
      const data = snap.val() || {};
 
      // Populate fields — fall back to email as display name if not yet set
      document.getElementById("field-display-name").value = data.displayName || user.email || "";
      document.getElementById("field-primary-email").value = user.email || "";
      document.getElementById("field-secondary-email").value = data.secondaryEmail || "";
      document.getElementById("field-bio").value = data.bio || "";
      document.getElementById("field-phone").value = data.phone || "";
      document.getElementById("toggle-email-notif").checked = data.emailNotifications !== false;
      document.getElementById("toggle-phone-notif").checked = data.phoneNotifications === true;
 
      // Role badge
      const role = (data.role || "member").toUpperCase().replace(/_/g, " ");
      const roleBadge = document.getElementById("role-badge");
      roleBadge.textContent = role;
      if (data.role === "admin" || data.role === "exec_board") {
        roleBadge.classList.add("role--exec");
      }
 
      // Show admin panel link if applicable
      if (data.role === "admin" || data.role === "exec_board") {
        document.getElementById("admin-link-wrap")?.style.removeProperty("display");
      }
 
      // Save handler
      document.getElementById("btn-save").addEventListener("click", async () => {
        const btn = document.getElementById("btn-save");
        btn.disabled = true;
        btn.textContent = "Saving…";
 
        const updates = {
          displayName: document.getElementById("field-display-name").value.trim(),
          secondaryEmail: document.getElementById("field-secondary-email").value.trim(),
          bio: document.getElementById("field-bio").value.trim(),
          phone: document.getElementById("field-phone").value.trim(),
          emailNotifications: document.getElementById("toggle-email-notif").checked,
          phoneNotifications: document.getElementById("toggle-phone-notif").checked,
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
      });
 
      // Sign out handler
      document.getElementById("btn-signout").addEventListener("click", async () => {
        await signOut(auth);
        window.location.href = "/index.html";
      });
    });
 
    function showToast(msg, type = "success") {
      const toast = document.getElementById("toast");
      toast.textContent = msg;
      toast.className = "toast toast--" + type + " toast--visible";
      setTimeout(() => toast.classList.remove("toast--visible"), 3500);
    }
 
    window._tefSignOut = () => signOut(auth).then(() => window.location.href = "/index.html");