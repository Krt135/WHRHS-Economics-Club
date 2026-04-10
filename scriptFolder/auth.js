import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } 
    from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getDatabase, ref, set, get } 
    from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";
import { firebaseConfig } from './app.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// 1. HARDCODED EXEC EMAILS
const execEmails = [
    "kartikeyapant2009@gmail.com", 
    "besada.a.265@gmail.com",
    "placeholder3@gmail.com", // Replace these when ready
    "placeholder4@gmail.com"
];

// Tip: Using .toLowerCase() in the check ensures it works even if they type 
// their email with capital letters by accident.

// --- SIGN UP LOGIC ---
document.getElementById('signUpForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signUpEmail').value;
    const pass = document.getElementById('signUpPassword').value;
    const confirm = document.getElementById('signUpConfirm').value;

    if (pass !== confirm) return alert("Passwords do not match!");

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
        const user = userCredential.user;

        // Determine if they are an Exec or Pending
        const isExec = execEmails.includes(email.toLowerCase());
        const userData = {
            email: email,
            role: isExec ? "admin" : "member",
            status: isExec ? "approved" : "pending"
        };

        // Save to database
        await set(ref(db, 'users/' + user.uid), userData);

        if (isExec) {
            alert("Exec account created! Redirecting...");
            window.location.href = "index.html";
        } else {
            alert("Request sent! An admin will review your account soon.");
            window.location.href = "auth.html"; // Stay here or go to a "pending" page
        }
    } catch (error) {
        alert(error.message);
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

        // Check their status in the database
        const snapshot = await get(ref(db, 'users/' + user.uid));
        const data = snapshot.val();

        if (data.status === "pending") {
            alert("Your account is still pending approval by the Exec Board.");
            auth.signOut(); // Log them back out if not approved
        } else {
            window.location.href = "index.html";
        }
    } catch (error) {
        alert("Invalid credentials.");
    }
});