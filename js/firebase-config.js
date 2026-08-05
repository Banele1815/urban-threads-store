import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";

import { getFirestore } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDMGaL0KYmJakJt4wqefY7-mL-XKDCqlTc",
  authDomain: "urbanthreadsstore-5d0c2.firebaseapp.com",
  projectId: "urbanthreadsstore-5d0c2",
  storageBucket: "urbanthreadsstore-5d0c2.firebasestorage.app",
  messagingSenderId: "1093800275703",
  appId: "1:1093800275703:web:23e9e5ddff2756c09dedf2"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };