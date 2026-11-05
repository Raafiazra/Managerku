import {
  EmailAuthProvider,
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { firebaseAuth } from "./firebase-client.js";

export class AuthService {
  #auth;

  constructor(auth = firebaseAuth) {
    this.#auth = auth;
  }

  get currentUser() {
    return this.#auth.currentUser;
  }

  observeState(callback) {
    return onAuthStateChanged(this.#auth, callback);
  }

  async signIn(email, password, remember = true) {
    const persistence = remember ? browserLocalPersistence : browserSessionPersistence;
    await setPersistence(this.#auth, persistence);
    return signInWithEmailAndPassword(this.#auth, email, password);
  }

  createAccount(email, password) {
    return createUserWithEmailAndPassword(this.#auth, email, password);
  }

  sendPasswordReset(email) {
    return sendPasswordResetEmail(this.#auth, email);
  }

  signOut() {
    return signOut(this.#auth);
  }

  reauthenticate(user, password) {
    const credential = EmailAuthProvider.credential(user.email, password);
    return reauthenticateWithCredential(user, credential);
  }

  changePassword(user, password) {
    return updatePassword(user, password);
  }

  updateProfile(user, profile) {
    return updateProfile(user, profile);
  }
}

export const authService = new AuthService();
