import {
    collection,
    addDoc,
    getDoc,
    getDocs,
    doc,
    query,
    where,
    updateDoc,
    deleteDoc,
    onSnapshot,
    serverTimestamp,
    orderBy,
    limit,
    Timestamp
} from "firebase/firestore";
import { db, auth } from "./firebase";

export interface FirestoreQuestion {
    id: string;
    imageUrl: string;
    options: string[];
    active: boolean;
    correctAnswer: number | null;
    showAnswer: boolean;
    createdAt: Timestamp;
}

export interface FirestoreVote {
    id: string;
    questionId: string;
    optionIndex: number;
    userId: string;
    timestamp: Timestamp;
}

// 建立問題
export const createQuestion = async (imageUrl: string, options: string[]) => {
    // 先將所有現有問題設為非活動
    const q = query(collection(db, "questions"), where("active", "==", true));
    const activeDocs = await getDocs(q);
    for (const d of activeDocs.docs) {
        await updateDoc(doc(db, "questions", d.id), { active: false });
    }

    const docRef = await addDoc(collection(db, "questions"), {
        imageUrl,
        options,
        active: true,
        correctAnswer: null,
        showAnswer: false,
        createdAt: serverTimestamp(),
    });

    return { id: docRef.id, imageUrl, options, active: true, correctAnswer: null, showAnswer: false };
};

// 取得活動問題
export const getActiveQuestion = (callback: (question: FirestoreQuestion | null) => void) => {
    const q = query(
        collection(db, "questions"),
        where("active", "==", true),
        orderBy("createdAt", "desc"),
        limit(1)
    );

    return onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            callback(null);
        } else {
            const d = snapshot.docs[0];
            callback({ id: d.id, ...d.data() } as FirestoreQuestion);
        }
    });
};

// 取得特定問題
export const getQuestion = async (id: string) => {
    const docRef = doc(db, "questions", id);
    const d = await getDoc(docRef);
    if (d.exists()) {
        return { id: d.id, ...d.data() } as FirestoreQuestion;
    }
    return null;
};

// 投票
export const addVote = async (questionId: string, optionIndex: number) => {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("未登入");

    // 檢查是否已投票
    const q = query(
        collection(db, "votes"),
        where("questionId", "==", questionId),
        where("userId", "==", userId)
    );
    const existingVotes = await getDocs(q);
    if (!existingVotes.empty) {
        throw new Error("您已經投過票了");
    }

    await addDoc(collection(db, "votes"), {
        questionId,
        optionIndex,
        userId,
        timestamp: serverTimestamp(),
    });
};

// 取得投票統計 (即時)
export const getVotesStats = (questionId: string, callback: (stats: Record<number, number>) => void) => {
    const q = query(collection(db, "votes"), where("questionId", "==", questionId));

    return onSnapshot(q, (snapshot) => {
        const stats: Record<number, number> = {};
        snapshot.docs.forEach((d) => {
            const data = d.data();
            stats[data.optionIndex] = (stats[data.optionIndex] || 0) + 1;
        });
        callback(stats);
    });
};

// 重置投票
export const resetVotes = async (questionId: string) => {
    const q = query(collection(db, "votes"), where("questionId", "==", questionId));
    const snapshot = await getDocs(q);
    for (const d of snapshot.docs) {
        await deleteDoc(doc(db, "votes", d.id));
    }
};

// 設定正確答案
export const setCorrectAnswer = async (questionId: string, index: number) => {
    await updateDoc(doc(db, "questions", questionId), { correctAnswer: index });
};

// 顯示/隱藏答案
export const toggleShowAnswer = async (questionId: string, show: boolean) => {
    await updateDoc(doc(db, "questions", questionId), { showAnswer: show });
};
