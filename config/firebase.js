import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCweWZlM2npwgwv8sLNkAZ-_xFCgQpg-bA",
  authDomain: "managerku-84551.firebaseapp.com",
  projectId: "managerku-84551",
  storageBucket: "managerku-84551.firebasestorage.app",
  messagingSenderId: "1048798311961",
  appId: "1:1048798311961:web:8f259a6a845f64bcaf5c88",
  measurementId: "G-06FJVDSVYR"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export { db as firestore };
