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
    "saibhavsar17@gmail.com",
    "placeholder4@gmail.com"
];

const passwordResetActionCodeSettings = {
    url: `https://theeconomicforum.net/auth.html`,
    handleCodeInApp: false
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

// Firebase's own messages read like "Firebase: Error (auth/...)." - translate the
// ones a member can actually hit into plain language.
function friendlyAuthError(error) {
    switch (error && error.code) {
        case 'auth/invalid-credential':
        case 'auth/invalid-login-credentials':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
            return 'Incorrect email or password.';
        case 'auth/invalid-email':
            return 'Please enter a valid email address.';
        case 'auth/too-many-requests':
            return 'Too many attempts. Please wait a few minutes and try again.';
        case 'auth/network-request-failed':
            return 'Network error. Check your connection and try again.';
        case 'auth/user-disabled':
            return 'This account has been disabled. Please contact the Exec Board.';
        case 'auth/email-already-in-use':
            return 'An account with this email already exists. Try signing in, or use "Forgot password?".';
        case 'auth/weak-password':
            return 'That password is too weak. Use at least 8 characters.';
        default:
            return null;
    }
}

// --- SIGN UP LOGIC ---
document.getElementById('signUpForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signUpEmail').value.trim();
    const pass = document.getElementById('signUpPassword').value;
    const confirm = document.getElementById('signUpConfirm').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');

    setAuthFeedback('signUpFeedback', '', '');
    if (pass !== confirm) {
        setAuthFeedback('signUpFeedback', 'Passwords do not match.', 'error');
        return;
    }

    // Disabled for the whole sign-up: a second click used to start a second
    // account creation, which fails with "email already in use".
    submitBtn.disabled = true;
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
        const user = userCredential.user;

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
            await auth.signOut();
            alert("Account created! Please check your email to verify your address, then wait for Exec Board approval before signing in.");
            window.location.href = "auth.html";
        }
    } catch (error) {
        console.error("Sign-up error:", error);
        setAuthFeedback('signUpFeedback',
            friendlyAuthError(error) || 'Could not create your account. Please try again.', 'error');
        submitBtn.disabled = false;
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
    const email = document.getElementById('signInEmail').value.trim();
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
            // There was no other way to get a new link if the first email was
            // lost or expired, so send a fresh one each time this gate is hit.
            let message = 'Please verify your email address first. Check your inbox for the verification link.';
            try {
                await sendEmailVerification(user);
                message = `Please verify your email address first. We just sent a new verification link to ${user.email} (check your spam folder too).`;
            } catch (verifyErr) {
                console.warn("Could not resend verification email:", verifyErr);
            }
            await auth.signOut();
            setAuthFeedback('signInFeedback', message, 'error');
            return;
        }

        // Fetch user data from Database
        const snapshot = await get(ref(db, 'users/' + user.uid));
        let data = snapshot.val();

        // The sign-in account exists but its forum record doesn't (e.g. the
        // record write failed during sign-up). "Sign up again" is impossible -
        // the email is already taken - so recreate the record the same way
        // sign-up does, which puts a normal member back in the approval queue.
        if (!data) {
            data = {
                email: user.email,
                role: isExec ? "admin" : "member",
                status: isExec ? "approved" : "pending",
                uid: user.uid
            };
            try {
                await set(ref(db, 'users/' + user.uid), data);
            } catch (writeErr) {
                console.error("Could not recreate missing user record:", writeErr);
                await auth.signOut();
                setAuthFeedback('signInFeedback', 'Your account is missing its forum profile. Please contact the Exec Board.', 'error');
                return;
            }
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
        setAuthFeedback('signInFeedback', friendlyAuthError(error) || 'Sign-in failed. Please try again.', 'error');
    } finally {
        // Every failure path above returns early; without this the button
        // stayed disabled after one wrong password until the page was reloaded.
        submitBtn.disabled = false;
    }
});
