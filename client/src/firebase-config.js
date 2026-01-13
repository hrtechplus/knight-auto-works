import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyD4_7X3Hy2VOlX1Lt4bXyRoVwagYKfaxUM",
  authDomain: "knight-auto-works-f128c.firebaseapp.com",
  projectId: "knight-auto-works-f128c",
  storageBucket: "knight-auto-works-f128c.firebasestorage.app",
  messagingSenderId: "427868175394",
  appId: "1:427868175394:web:06218a8846507166b5de7b",
  measurementId: "G-ZKLBBENMFS"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const analytics = getAnalytics(app);
