import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
    sendEmailVerification, sendPasswordResetEmail }
from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getDatabase, ref, set, get }
    from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";
import { firebaseConfig } from './config.js';


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const execEmails = [
    "kartikeyapant2009@gmail.com",
    "besada.a.265@gmail.com",
    "placeholder3@gmail.com",
    "placeholder4@gmail.com"
];

const passwordResetActionCodeSettings = {
    url: `${window.location.origin}/auth-action.html`,
    handleCodeInApp: false;
};
function setAuthFeedback(elementId, message, type) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.hidden = !message;
    el.textContent = message;
    el.className = "auth-feedback" + (type ? ` auth-feedback--${type}` : "");
}
const RESET_EMAIL_SENT_MESSAGE =
    "If an account exists for that email, we sent a password reset link. Check your inbox and spam folder.";

// --- SIGN UP LOGIC ---
document.getElementById('signUpForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signUpEmail').value;
    const pass = document.getElementById('signUpPassword').value;
    const confirm = document.getElementById('signUpConfirm').value;

    if (pass !== confirm) return alert("Passwords do not match!");

    try {
         console.log("1. Starting signup...");
        const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
        const user = userCredential.user;
        console.log("2. User created:", user.uid);

        const isExec = execEmails.includes(email.toLowerCase());

        await set(ref(db, 'users/' + user.uid), {
            email: email,
            role: isExec ? "admin" : "member",
            status: isExec ? "approved" : "pending",
            uid: user.uid
        });

        if (isExec) {
            // Exec skips email verification — trust the hardcoded list
            alert("Exec Board identity verified. Welcome.");
            window.location.href = "index.html";
        } else {
            // Send verification email before anything else
            await sendEmailVerification(user);
            console.log("Verification email sent to:", user.email);
            await auth.signOut();
            alert("Account created! Please check your email to verify your address, then wait for Exec Board approval before signing in.");
            window.location.reload();
        }
    } catch (error) {
        console.error(error.code);
        alert("Error: " + error.message);
    }
});

document.getElementById('forgotPasswordForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgotPasswordEmail').value.trim();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (!email) {
        setAuthFeedback('forgotPasswordFeedback', 'Please enter your email address.', 'error');
        return;
    }
    submitBtn.disabled = true;
    setAuthFeedback('forgotPasswordFeedback', '', '');
    try {
        await sendPasswordResetEmail(auth, email, passwordResetActionCodeSettings);
    } catch (error) {
        if (error.code === 'auth/invalid-email') {
            setAuthFeedback('forgotPasswordFeedback', 'Please enter a valid email address.', 'error');
            submitBtn.disabled = false;
            return;
        }
        if (error.code === 'auth/too-many-requests') {
            setAuthFeedback('forgotPasswordFeedback', 'Too many attempts. Please try again later.', 'error');
            submitBtn.disabled = false;
            return;
        }
        // auth/user-not-found and other errors: show generic success (no enumeration)
    }

    setAuthFeedback('forgotPasswordFeedback', RESET_EMAIL_SENT_MESSAGE, 'success');
    submitBtn.disabled = false;
});

// --- SIGN IN LOGIC ---
document.getElementById('signInForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signInEmail').value;
    const pass = document.getElementById('signInPassword').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');

    setAuthFeedback('signInFeedback', '', '');
    submitBtn.disabled = true;

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, pass);
        const user = userCredential.user;

        // Check if the user is an Exec Board member
        const isExec = execEmails.includes(user.email.toLowerCase());

        // Gate 1: email verified? (BYPASSED for Execs)
        if (!isExec && !user.emailVerified) {
            await auth.signOut();
            setAuthFeedback('signInFeedback', 'Please verify your email address first. Check your inbox for a verification link.', 'error');
            return;
        }

        // Fetch user data from Database
        const snapshot = await get(ref(db, 'users/' + user.uid));
        const data = snapshot.val();

        // Safety: Check if user actually exists in the database
        if (!data) {
            await auth.signOut();
            setAuthFeedback('signInFeedback', 'Account found in Auth, but missing from Database. Please contact an admin or sign up again.', 'error');
            return;
        }

        // Gate 2: admin approved?
        if (data.status === "pending") {
            await auth.signOut();
            setAuthFeedback('signInFeedback', 'Your email is verified! Your account is still pending approval by the Exec Board.', 'error');
            return;
        }

        // Success!
        window.location.href = "index.html";

    } catch (error) {
        console.error("Sign-in error:", error);
        setAuthFeedback('signInFeedback', 'Invalid credentials.', 'error');
    }
});
