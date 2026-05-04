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
    teacherId: string;
    createdAt: Timestamp;
    expiresAt: Timestamp;
    roomCode: string;
}

// 題目預設存活時間：4 小時（涵蓋一節課 + 緩衝時間）
export const QUESTION_TTL_MS = 4 * 60 * 60 * 1000;

// 房間代碼字元集（避開易混淆的 0/O/1/I/L），31 字元 → 4 碼約 92 萬組合
const ROOM_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const generateRoomCode = (length = 4): string => {
    let code = "";
    for (let i = 0; i < length; i++) {
        code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
    }
    return code;
};

// 產生未被使用過的 room code（最多重試 8 次，撞到就升 5 碼確保不卡）
const generateUniqueRoomCode = async (): Promise<string> => {
    for (let attempt = 0; attempt < 8; attempt++) {
        const code = generateRoomCode(4);
        const q = query(collection(db, "questions"), where("roomCode", "==", code), limit(1));
        const snap = await getDocs(q);
        if (snap.empty) return code;
    }
    return generateRoomCode(5);
};

// 判斷題目是否已過期
export const isQuestionExpired = (q: Pick<FirestoreQuestion, "expiresAt"> | null | undefined): boolean => {
    if (!q?.expiresAt) return false;
    return q.expiresAt.toMillis() < Date.now();
};

export interface FirestoreVote {
    id: string;
    questionId: string;
    optionIndex: number;
    userId: string;
    timestamp: Timestamp;
}

// 建立問題
export const createQuestion = async (imageUrl: string, options: string[]) => {
    const teacherId = auth.currentUser?.uid;
    if (!teacherId) throw new Error("未登入");

    // 只將「自己」現有的活動問題設為非活動，避免影響其他老師
    const q = query(
        collection(db, "questions"),
        where("active", "==", true),
        where("teacherId", "==", teacherId)
    );
    const activeDocs = await getDocs(q);
    for (const d of activeDocs.docs) {
        await updateDoc(doc(db, "questions", d.id), { active: false });
    }

    const expiresAt = Timestamp.fromMillis(Date.now() + QUESTION_TTL_MS);
    const roomCode = await generateUniqueRoomCode();

    const docRef = await addDoc(collection(db, "questions"), {
        imageUrl,
        options,
        active: true,
        correctAnswer: null,
        showAnswer: false,
        teacherId,
        createdAt: serverTimestamp(),
        expiresAt,
        roomCode,
    });

    return { id: docRef.id, imageUrl, options, active: true, correctAnswer: null, showAnswer: false, teacherId, expiresAt, roomCode };
};

// 用 room code 找對應的 question（給 /join 頁面用）
// 同 code 可能有多筆歷史題目，回傳「最新建立的 active 題目」優先，否則回傳最新一筆
export const findQuestionByRoomCode = async (code: string): Promise<FirestoreQuestion | null> => {
    const normalized = code.trim().toUpperCase();
    if (!normalized) return null;

    // 先試 active 的
    const activeQ = query(
        collection(db, "questions"),
        where("roomCode", "==", normalized),
        where("active", "==", true),
        limit(1)
    );
    const activeSnap = await getDocs(activeQ);
    if (!activeSnap.empty) {
        const d = activeSnap.docs[0];
        return { id: d.id, ...d.data() } as FirestoreQuestion;
    }

    // 沒有 active 的就回最新一筆
    const anyQ = query(
        collection(db, "questions"),
        where("roomCode", "==", normalized),
        orderBy("createdAt", "desc"),
        limit(1)
    );
    const anySnap = await getDocs(anyQ);
    if (anySnap.empty) return null;
    const d = anySnap.docs[0];
    return { id: d.id, ...d.data() } as FirestoreQuestion;
};

// 取得自己的活動問題（每位老師只看到自己的，不會被其他老師干擾）
export const getActiveQuestion = (callback: (question: FirestoreQuestion | null) => void) => {
    const teacherId = auth.currentUser?.uid;
    if (!teacherId) {
        callback(null);
        return () => {};
    }

    const q = query(
        collection(db, "questions"),
        where("active", "==", true),
        where("teacherId", "==", teacherId),
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

// 監聽特定問題
export const listenToQuestion = (id: string, callback: (question: FirestoreQuestion | null) => void) => {
    const docRef = doc(db, "questions", id);
    return onSnapshot(docRef, (d) => {
        if (d.exists()) {
            callback({ id: d.id, ...d.data() } as FirestoreQuestion);
        } else {
            callback(null);
        }
    });
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

// 停用問題
export const deactivateQuestion = async (questionId: string) => {
    await updateDoc(doc(db, "questions", questionId), { active: false });
};

// 列出自己所有題目（dashboard 用）
export const listMyQuestions = async (): Promise<FirestoreQuestion[]> => {
    const teacherId = auth.currentUser?.uid;
    if (!teacherId) return [];
    const q = query(
        collection(db, "questions"),
        where("teacherId", "==", teacherId),
        orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as FirestoreQuestion);
};

// 重新啟用舊題：先把自己其他 active 的關掉，再把這題開啟並把 expiresAt 重設為 now + TTL
export const reactivateQuestion = async (questionId: string) => {
    const teacherId = auth.currentUser?.uid;
    if (!teacherId) throw new Error("未登入");

    const activesQ = query(
        collection(db, "questions"),
        where("active", "==", true),
        where("teacherId", "==", teacherId)
    );
    const activeDocs = await getDocs(activesQ);
    for (const d of activeDocs.docs) {
        if (d.id !== questionId) {
            await updateDoc(doc(db, "questions", d.id), { active: false });
        }
    }

    await updateDoc(doc(db, "questions", questionId), {
        active: true,
        expiresAt: Timestamp.fromMillis(Date.now() + QUESTION_TTL_MS),
    });
};

// 刪除題目（連同所有票一起刪）
export const deleteQuestion = async (questionId: string) => {
    const votesQ = query(collection(db, "votes"), where("questionId", "==", questionId));
    const voteSnapshot = await getDocs(votesQ);
    for (const d of voteSnapshot.docs) {
        await deleteDoc(doc(db, "votes", d.id));
    }
    await deleteDoc(doc(db, "questions", questionId));
};

// 一次性取得多題的票數（dashboard 用，避免每題各開一個訂閱）
export const getVoteCountsForQuestions = async (
    questionIds: string[]
): Promise<Record<string, number>> => {
    const counts: Record<string, number> = {};
    if (questionIds.length === 0) return counts;
    // Firestore where-in 上限 30，分批
    for (let i = 0; i < questionIds.length; i += 30) {
        const batch = questionIds.slice(i, i + 30);
        const q = query(collection(db, "votes"), where("questionId", "in", batch));
        const snapshot = await getDocs(q);
        snapshot.docs.forEach((d) => {
            const qid = d.data().questionId as string;
            counts[qid] = (counts[qid] || 0) + 1;
        });
    }
    return counts;
};
