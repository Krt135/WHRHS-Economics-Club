import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getDatabase, ref, get, update } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";
import { firebaseConfig } from "./config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

/** Firebase Auth UIDs are alphanumeric; reject other query values for safe paths. */
function parseProfileUidParam() {
  const raw = new URLSearchParams(window.location.search).get("uid");
  if (!raw) return null;
  const uid = raw.trim();
  if (!uid || uid.length > 128 || !/^[a-zA-Z0-9]+$/.test(uid)) return null;
  return uid;
}

function showToast(msg, type = "success") {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.className = "toast toast--" + type + " toast--visible";
  setTimeout(() => toast.classList.remove("toast--visible"), 3500);
}

function setRoleBadge(roleBadge, data) {
  const role = (data.role || "member").toUpperCase().replace(/_/g, " ");
  roleBadge.textContent = role;
  roleBadge.classList.toggle("role--exec", data.role === "admin" || data.role === "exec_board");
}

function showProfileError() {
  document.getElementById("profile-error-state").hidden = false;
  document.getElementById("profile-app-body").hidden = true;
}

function showProfileApp() {
  document.getElementById("profile-error-state").hidden = true;
  document.getElementById("profile-app-body").hidden = false;
}

function wireOwnProfile(user, data) {
  const displayNameEl = document.getElementById("field-display-name");
  const primaryEmailEl = document.getElementById("field-primary-email");
  const secondaryEmailEl = document.getElementById("field-secondary-email");
  const bioEl = document.getElementById("field-bio");
  const phoneEl = document.getElementById("field-phone");
  const roleBadge = document.getElementById("role-badge");
  const mainEl = document.getElementById("profile-main");

  mainEl.classList.remove("profile-main--viewing-member");
  showProfileApp();

  document.title = "Your Profile – The Economic Forum";
  document.getElementById("profile-page-title").textContent = "Your Profile";
  document.getElementById("profile-page-subtitle").textContent =
    "Manage your account settings and notification preferences.";
  document.getElementById("profile-account-card-title-text").textContent = "Account Information";

  document.getElementById("field-group-primary-email").hidden = false;
  document.getElementById("field-group-secondary-email").hidden = false;
  document.getElementById("field-group-member-phone").hidden = true;
  document.getElementById("profile-card-notifications").hidden = false;
  const actionsEl = document.getElementById("profile-actions");
  actionsEl.hidden = false;
  actionsEl.removeAttribute("aria-hidden");
  actionsEl.querySelectorAll("button").forEach((b) => b.removeAttribute("tabindex"));

  document.getElementById("label-primary-email").textContent = "Primary Email (Login)";
  document.getElementById("hint-primary-email").hidden = false;

  [displayNameEl, bioEl, secondaryEmailEl].forEach((el) => {
    el.removeAttribute("readonly");
    el.removeAttribute("aria-readonly");
  });
  phoneEl.removeAttribute("readonly");

  displayNameEl.value = data.displayName || user.email || "";
  primaryEmailEl.value = user.email || "";
  secondaryEmailEl.value = data.secondaryEmail || "";
  bioEl.value = data.bio || "";
  phoneEl.value = data.phone || "";
  document.getElementById("toggle-email-notif").checked = data.emailNotifications !== false;
  document.getElementById("toggle-phone-notif").checked = data.phoneNotifications === true;

  setRoleBadge(roleBadge, data);

  if (data.role === "admin" || data.role === "exec_board") {
    document.getElementById("admin-link-wrap")?.style.removeProperty("display");
  }

  document.getElementById("btn-save").onclick = async () => {
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
  };

  document.getElementById("btn-signout").onclick = async () => {
    await signOut(auth);
    window.location.href = "index.html";
  };
}

function wireMemberProfile(data) {
  const mainEl = document.getElementById("profile-main");
  const displayNameEl = document.getElementById("field-display-name");
  const bioEl = document.getElementById("field-bio");
  const roleBadge = document.getElementById("role-badge");
  const primaryEmailEl = document.getElementById("field-primary-email");
  const secondaryEmailEl = document.getElementById("field-secondary-email");
  const phoneMemberEl = document.getElementById("field-member-phone");

  mainEl.classList.add("profile-main--viewing-member");
  showProfileApp();

  const name = (data.displayName || "").trim() || "Member";
  document.title = `${name} – The Economic Forum`;
  document.getElementById("profile-page-title").textContent = name;
  document.getElementById("profile-page-subtitle").innerHTML =
    'Club member profile. <a href="profile.html">Your profile &amp; settings</a>';

  document.getElementById("profile-account-card-title-text").textContent = "Profile";

  const emailPrimary = (data.email || "").trim();
  const emailSecondary = (data.secondaryEmail || "").trim();
  const phone = (data.phone || "").trim();

  document.getElementById("field-group-primary-email").hidden = !emailPrimary;
  if (emailPrimary) {
    primaryEmailEl.value = emailPrimary;
    document.getElementById("label-primary-email").textContent = "Email";
    document.getElementById("hint-primary-email").hidden = true;
  }

  document.getElementById("field-group-secondary-email").hidden = !emailSecondary;
  if (emailSecondary) {
    secondaryEmailEl.value = emailSecondary;
    secondaryEmailEl.readOnly = true;
    secondaryEmailEl.setAttribute("aria-readonly", "true");
  } else {
    secondaryEmailEl.value = "";
    secondaryEmailEl.removeAttribute("readonly");
    secondaryEmailEl.removeAttribute("aria-readonly");
  }

  const phoneGroup = document.getElementById("field-group-member-phone");
  phoneGroup.hidden = !phone;
  if (phone) {
    phoneMemberEl.value = phone;
    phoneMemberEl.readOnly = true;
    phoneMemberEl.setAttribute("aria-readonly", "true");
  } else {
    phoneMemberEl.value = "";
    phoneMemberEl.removeAttribute("readonly");
    phoneMemberEl.removeAttribute("aria-readonly");
  }

  document.getElementById("profile-card-notifications").hidden = true;

  const actionsEl = document.getElementById("profile-actions");
  actionsEl.hidden = true;
  actionsEl.setAttribute("aria-hidden", "true");
  actionsEl.querySelectorAll("button").forEach((b) => b.setAttribute("tabindex", "-1"));

  displayNameEl.value = name;
  displayNameEl.readOnly = true;
  displayNameEl.setAttribute("aria-readonly", "true");

  bioEl.value = (data.bio || "").trim();
  bioEl.readOnly = true;
  bioEl.setAttribute("aria-readonly", "true");
  bioEl.placeholder = "No bio yet.";

  setRoleBadge(roleBadge, data);

  document.getElementById("btn-save").onclick = null;
  document.getElementById("btn-signout").onclick = null;
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "auth.html";
    return;
  }

  let viewUid = parseProfileUidParam();
  if (viewUid && viewUid === user.uid) {
    history.replaceState(null, "", "profile.html");
    viewUid = null;
  }

  if (viewUid) {
    let snap;
    try {
      snap = await get(ref(db, `users/${viewUid}`));
    } catch (e) {
      console.error(e);
      showProfileError();
      document.title = "Profile unavailable – The Economic Forum";
      return;
    }
    if (!snap.exists()) {
      showProfileError();
      document.title = "Profile unavailable – The Economic Forum";
      return;
    }
    wireMemberProfile(snap.val() || {});
    return;
  }

  const snap = await get(ref(db, `users/${user.uid}`));
  const data = snap.val() || {};
  wireOwnProfile(user, data);
});

window._tefSignOut = () => signOut(auth).then(() => (window.location.href = "index.html"));
