 import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';

// --- FILE 1: AUTHENTICATION SERVICE ---
export class AuthService {
    constructor(appConfig) {
        this.app = initializeApp(appConfig);
        this.auth = getAuth(this.app);
        this.provider = new GoogleAuthProvider();
        this.currentUser = null;
    }

    async login() {
        try {
            await signInWithPopup(this.auth, this.provider);
        } catch (error) {
            throw error;
        }
    }

    async logout() {
        await signOut(this.auth);
    }

    onStateChange(callback) {
        onAuthStateChanged(this.auth, (user) => {
            this.currentUser = user;
            callback(user);
        });
    }
}
