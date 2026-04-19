import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, 
         onAuthStateChanged, sendEmailVerification }
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

// --- SIGN IN LOGIC ---
document.getElementById('signInForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signInEmail').value;
    const pass = document.getElementById('signInPassword').value;

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, pass);
        const user = userCredential.user;

        // Gate 1: email verified?
        if (!user.emailVerified) {
            await auth.signOut();
            alert("Please verify your email address first. Check your inbox for a verification link.");
            return;
            
        }

        // Gate 2: admin approved?
        const snapshot = await get(ref(db, 'users/' + user.uid));
        const data = snapshot.val();

        if (data.status === "pending") {
            await auth.signOut();
            alert("Your email is verified! Your account is still pending approval by the Exec Board.");
            return;
        }

        window.location.href = "index.html";

    } catch (error) {
        alert("Invalid credentials.");
    }
});