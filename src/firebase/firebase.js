import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, FacebookAuthProvider, OAuthProvider } from "firebase/auth";
import { getFirestore, collection, addDoc, getDocs, query, orderBy } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAJKkXSjnh6tPxp6UYJBBotND4wil-a2Gs",
  authDomain: "markfy-96942.firebaseapp.com",
  projectId: "markfy-96942",
  storageBucket: "markfy-96942.appspot.com",
  messagingSenderId: "638242144353",
  appId: "1:638242144353:web:8023d8bca99850d3cb6a20",
  measurementId: "G-HENJ7D82KH",
  databaseURL: "https://markfy-96942-default-rtdb.firebaseio.com/"
  };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app)

export const googleProvider = new GoogleAuthProvider();
export const facebookProvider = new FacebookAuthProvider();
export const appleProvider = new OAuthProvider('apple.com');

export const storage = getStorage(app);
export const db = getFirestore(app);
export const realtimeDb = getDatabase(app);

export { app, auth };
