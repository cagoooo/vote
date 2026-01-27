import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyCc3G3Y5o2Y7uKr0u4CCXX384vAEtWVi3c",
    authDomain: "vote-9db54.firebaseapp.com",
    projectId: "vote-9db54",
    storageBucket: "vote-9db54.firebasestorage.app",
    messagingSenderId: "914429535615",
    appId: "1:914429535615:web:474d7401d7cb430a2ce64a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// 匿名登入函數
export const loginAnonymously = async () => {
    try {
        const userCredential = await signInAnonymously(auth);
        return userCredential.user;
    } catch (error) {
        console.error("Firebase 匿名登入失敗:", error);
        throw error;
    }
};
