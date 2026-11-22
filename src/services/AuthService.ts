
import { initializeApp, type FirebaseApp } from 'firebase/app';

import {
  initializeAuth,
  inMemoryPersistence,
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

export class AuthService {
  private app: FirebaseApp;
  private auth: Auth;

  constructor() {
    const apiKey = process.env['FIREBASE_API_KEY'];
    const authDomain = process.env['FIREBASE_AUTH_DOMAIN'];
    const projectId = process.env['FIREBASE_PROJECT_ID'];

    if (!apiKey || !authDomain || !projectId) {
      throw new Error('Missing Firebase environment variables');
    }

    this.app = initializeApp({
      apiKey,
      authDomain,
      projectId,
    });

    this.auth = initializeAuth(this.app, {
      persistence: inMemoryPersistence,
    });
  }

  async signUp(email: string, password: string): Promise<AuthResult> {
    try {
      const cred = await createUserWithEmailAndPassword(
        this.auth,
        email,
        password
      );

      return { user: cred.user, error: null };
    } catch (e: any) {
      return { user: null, error: this.friendlyError(e) };
    }
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
    try {
      const cred = await signInWithEmailAndPassword(
        this.auth,
        email,
        password
      );

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
      'auth/invalid-api-key': 'Invalid Firebase API key',
      'auth/email-already-in-use': 'Email already registered',
      'auth/invalid-email': 'Invalid email address',
      'auth/weak-password': 'Password must contain at least 6 characters',
      'auth/user-not-found': 'No account found. Sign up first',
      'auth/wrong-password': 'Incorrect password',
      'auth/invalid-credential': 'Incorrect email or password',
      'auth/operation-not-allowed': 'Enable Email/Password authentication in Firebase',
      'auth/network-request-failed': 'Network connection failed',
      'auth/too-many-requests': 'Too many attempts. Try again later',
    };

    return map[code] ?? (code ? `Firebase error: ${code}` : String(e));
  }
}
