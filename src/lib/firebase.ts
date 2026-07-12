import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB5AbM8zHTAcp6PqGhC2PW0uxRfhFtMaEw",
  authDomain: "cha-ching-c3470.firebaseapp.com",
  projectId: "cha-ching-c3470",
  storageBucket: "cha-ching-c3470.firebasestorage.app",
  messagingSenderId: "791695908223",
  appId: "1:791695908223:web:a91f400cc8339e579c8e4a",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
