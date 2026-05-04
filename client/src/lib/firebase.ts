import { initializeApp } from "firebase/app";
import {
    getAuth,
    signInAnonymously,
    GoogleAuthProvider,
    signInWithPopup,
    signInWithCredential,
    linkWithPopup,
    signOut as fbSignOut,
    type User,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// 顯式指定 storageBucket：新版 Firebase 預設是 .firebasestorage.app（雷 #8）
// 用 projectId 推導，避開 GitHub Secret 可能還是舊的 .appspot.com 格式
const projectIdForStorage = import.meta.env.VITE_FIREBASE_PROJECT_ID || "vote-9db54";
export const storage = getStorage(app, `gs://${projectIdForStorage}.firebasestorage.app`);

// 匿名登入（給學生用，與舊版相容）
export const loginAnonymously = async () => {
    try {
        const userCredential = await signInAnonymously(auth);
        return userCredential.user;
    } catch (error) {
        console.error("Firebase 匿名登入失敗:", error);
        throw error;
    }
};

// Google 登入：若目前是匿名使用者，優先用 linkWithPopup 升級（保留 uid 與舊題擁有權）；
// 若 Google 帳號已被綁過其他 Firebase 帳號，fallback 用 signInWithCredential 切換過去（uid 會換）
export const signInWithGoogle = async (): Promise<User> => {
    const provider = new GoogleAuthProvider();
    const current = auth.currentUser;

    if (current && current.isAnonymous) {
        try {
            const result = await linkWithPopup(current, provider);
            return result.user;
        } catch (err: any) {
            if (err.code === "auth/credential-already-in-use") {
                const credential = GoogleAuthProvider.credentialFromError(err);
                if (credential) {
                    const result = await signInWithCredential(auth, credential);
                    return result.user;
                }
            }
            throw err;
        }
    }

    const result = await signInWithPopup(auth, provider);
    return result.user;
};

export const signOut = async () => {
    await fbSignOut(auth);
};
