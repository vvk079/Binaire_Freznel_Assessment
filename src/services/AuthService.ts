import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  type Auth,
  type User,
} from 'firebase/auth';

export interface AuthResult {
  user: User | null;
  error: string | null;
}

/**
 * Wraps Firebase Authentication.
 * Config is read from process.env — dotenv must be loaded before this class
 * is instantiated (done in src/index.ts before any imports).
 */
export class AuthService {
  private app: FirebaseApp;
  private auth: Auth;

  constructor() {
    this.app = initializeApp({
      apiKey: process.env['FIREBASE_API_KEY'] ?? '',
      authDomain: process.env['FIREBASE_AUTH_DOMAIN'] ?? '',
      projectId: process.env['FIREBASE_PROJECT_ID'] ?? '',
    });
    this.auth = getAuth(this.app);
  }

  async signUp(email: string, password: string): Promise<AuthResult> {
    try {
      const cred = await createUserWithEmailAndPassword(this.auth, email, password);
      return { user: cred.user, error: null };
    } catch (e: any) {
      return { user: null, error: this.friendlyError(e) };
    }
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
    try {
      const cred = await signInWithEmailAndPassword(this.auth, email, password);
      return { user: cred.user, error: null };
    } catch (e: any) {
      return { user: null, error: this.friendlyError(e) };
    }
  }

  async signOut(): Promise<void> {
    await fbSignOut(this.auth);
  }

  getCurrentUser(): User | null {
    return this.auth.currentUser;
  }

  onAuthStateChanged(cb: (user: User | null) => void): void {
    onAuthStateChanged(this.auth, cb);
  }

  private friendlyError(e: any): string {
    const code: string = e?.code ?? '';
    const map: Record<string, string> = {
      'auth/invalid-api-key':          'Invalid API key — check FIREBASE_API_KEY in .env',
      'auth/email-already-in-use':     'Email already registered — use Login mode (Ctrl+L)',
      'auth/invalid-email':            'Invalid email address',
      'auth/weak-password':            'Password too short — use at least 6 characters',
      'auth/user-not-found':           'No account with that email — sign up first (Ctrl+U)',
      'auth/wrong-password':           'Wrong password',
      'auth/invalid-credential':       'Wrong email or password',
      'auth/operation-not-allowed':    'Email/Password auth not enabled in Firebase Console',
      'auth/network-request-failed':   'Network error — check your internet connection',
      'auth/too-many-requests':        'Too many attempts — wait a moment and try again',
    };
    return map[code] ?? (code ? `Firebase error: ${code}` : String(e));
  }
}
