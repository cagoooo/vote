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

export type QuestionType = "single" | "multiple";

export interface FirestoreQuestion {
    id: string;
    imageUrl: string;
    options: string[];
    active: boolean;
    /** 單選正解（單選題用） */
    correctAnswer: number | null;
    /** 多選正解集合（多選題用，所有正確選項的 index 集合） */
    correctAnswers?: number[] | null;
    showAnswer: boolean;
    teacherId: string;
    createdAt: Timestamp;
    expiresAt: Timestamp;
    roomCode: string;
    /** 題型：single 單選（預設）、multiple 多選 */
    questionType?: QuestionType;
    /** 是否要求學生填具名才能投票 */
    requireIdentity?: boolean;
    /** 倒數計時投票結束時間 */
    votingEndsAt?: Timestamp | null;
}

export interface CreateQuestionOptions {
    requireIdentity?: boolean;
    questionType?: QuestionType;
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

// 判斷題目是否已過期（4 小時硬上限）
export const isQuestionExpired = (q: Pick<FirestoreQuestion, "expiresAt"> | null | undefined): boolean => {
    if (!q?.expiresAt) return false;
    return q.expiresAt.toMillis() < Date.now();
};

// 判斷倒數投票是否已結束（老師主動設的計時器）
export const isVotingTimeUp = (q: Pick<FirestoreQuestion, "votingEndsAt"> | null | undefined): boolean => {
    if (!q?.votingEndsAt) return false;
    return q.votingEndsAt.toMillis() < Date.now();
};

export interface FirestoreVote {
    id: string;
    questionId: string;
    optionIndex: number;
    userId: string;
    timestamp: Timestamp;
}

// 建立問題
export const createQuestion = async (
    imageUrl: string,
    options: string[],
    opts: CreateQuestionOptions = {}
) => {
    const teacherId = auth.currentUser?.uid;
    if (!teacherId) throw new Error("未登入");

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
    const requireIdentity = !!opts.requireIdentity;
    const questionType: QuestionType = opts.questionType ?? "single";

    const docRef = await addDoc(collection(db, "questions"), {
        imageUrl,
        options,
        active: true,
        correctAnswer: null,
        correctAnswers: null,
        showAnswer: false,
        teacherId,
        createdAt: serverTimestamp(),
        expiresAt,
        roomCode,
        questionType,
        requireIdentity,
        votingEndsAt: null,
    });

    return {
        id: docRef.id,
        imageUrl,
        options,
        active: true,
        correctAnswer: null,
        correctAnswers: null,
        showAnswer: false,
        teacherId,
        expiresAt,
        roomCode,
        questionType,
        requireIdentity,
        votingEndsAt: null,
    };
};

// 啟動倒數投票（老師按 30/60/90 秒按鈕後呼叫）
export const startCountdown = async (questionId: string, seconds: number) => {
    const endsAt = Timestamp.fromMillis(Date.now() + seconds * 1000);
    await updateDoc(doc(db, "questions", questionId), { votingEndsAt: endsAt });
    return endsAt;
};

// 取消倒數
export const cancelCountdown = async (questionId: string) => {
    await updateDoc(doc(db, "questions", questionId), { votingEndsAt: null });
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

// 投票（identity 為選填，需具名題目才會帶）
export interface VoteIdentity {
    name?: string;
    seat?: string;
}

/**
 * 投票
 *  - 單選：傳 number
 *  - 多選：傳 number[]（至少 1 個）
 */
export const addVote = async (
    questionId: string,
    selection: number | number[],
    identity?: VoteIdentity
) => {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("未登入");

    const q = query(
        collection(db, "votes"),
        where("questionId", "==", questionId),
        where("userId", "==", userId)
    );
    const existingVotes = await getDocs(q);
    if (!existingVotes.empty) {
        throw new Error("您已經投過票了");
    }

    const payload: Record<string, any> = {
        questionId,
        userId,
        timestamp: serverTimestamp(),
    };
    if (Array.isArray(selection)) {
        if (selection.length === 0) throw new Error("請至少選一個選項");
        // 去重 + 排序，避免相同票被重複計入
        payload.optionIndices = Array.from(new Set(selection)).sort((a, b) => a - b);
    } else {
        payload.optionIndex = selection;
    }
    if (identity?.name) payload.voterName = identity.name.trim().substring(0, 30);
    if (identity?.seat) payload.voterSeat = identity.seat.trim().substring(0, 10);

    await addDoc(collection(db, "votes"), payload);
};

// 取得某題完整投票明細（給老師結果頁用，含具名資訊）
export const getDetailedVotes = async (questionId: string) => {
    const q = query(
        collection(db, "votes"),
        where("questionId", "==", questionId),
        orderBy("timestamp", "asc")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
        const data = d.data() as any;
        return {
            id: d.id,
            optionIndex: data.optionIndex as number,
            voterName: data.voterName as string | undefined,
            voterSeat: data.voterSeat as string | undefined,
            timestamp: data.timestamp,
        };
    });
};

// 取得投票統計（即時）
// stats: 每個選項被選次數（多選時一張票可貢獻多個選項）
// totalVoters: 投票人數（vote 文件數，多選時 ≠ Σ stats）
export const getVotesStats = (
    questionId: string,
    callback: (stats: Record<number, number>, totalVoters: number) => void
) => {
    const q = query(collection(db, "votes"), where("questionId", "==", questionId));

    return onSnapshot(q, (snapshot) => {
        const stats: Record<number, number> = {};
        snapshot.docs.forEach((d) => {
            const data = d.data();
            if (Array.isArray(data.optionIndices)) {
                data.optionIndices.forEach((idx: number) => {
                    if (typeof idx === "number") stats[idx] = (stats[idx] || 0) + 1;
                });
            } else if (typeof data.optionIndex === "number") {
                stats[data.optionIndex] = (stats[data.optionIndex] || 0) + 1;
            }
        });
        callback(stats, snapshot.size);
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

// 編輯題目（限定可改的欄位，避免老師意外動到 teacherId / roomCode 等系統欄位）
export interface UpdateQuestionPatch {
    imageUrl?: string;
    options?: string[];
    questionType?: QuestionType;
    requireIdentity?: boolean;
    /** 若改了選項數量或題型，原 correctAnswer/correctAnswers 可能失效，由呼叫方決定是否清除 */
    correctAnswer?: number | null;
    correctAnswers?: number[] | null;
}

export const updateQuestion = async (questionId: string, patch: UpdateQuestionPatch) => {
    const cleaned: Record<string, any> = {};
    Object.entries(patch).forEach(([k, v]) => {
        if (v !== undefined) cleaned[k] = v;
    });
    if (Object.keys(cleaned).length === 0) return;
    await updateDoc(doc(db, "questions", questionId), cleaned);
};

// 設定正確答案（單選）
export const setCorrectAnswer = async (questionId: string, index: number) => {
    await updateDoc(doc(db, "questions", questionId), { correctAnswer: index });
};

// 設定正確答案（多選）— 全選對才算對
export const setCorrectAnswers = async (questionId: string, indices: number[]) => {
    const cleaned = Array.from(new Set(indices)).sort((a, b) => a - b);
    await updateDoc(doc(db, "questions", questionId), { correctAnswers: cleaned });
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

// 刪除題目（連同所有票 + Storage 圖片一起刪）
export const deleteQuestion = async (questionId: string) => {
    // 先撈題目拿 imageUrl 才能清 Storage
    const qDoc = await getDoc(doc(db, "questions", questionId));
    const imageUrl = (qDoc.data()?.imageUrl as string | undefined) ?? undefined;

    const votesQ = query(collection(db, "votes"), where("questionId", "==", questionId));
    const voteSnapshot = await getDocs(votesQ);
    for (const d of voteSnapshot.docs) {
        await deleteDoc(doc(db, "votes", d.id));
    }
    await deleteDoc(doc(db, "questions", questionId));

    // 圖片若是 Storage URL 就清掉；base64 inline 或 undefined 自動 no-op
    if (imageUrl) {
        try {
            const { deleteImageFromUrl } = await import("./image-storage");
            await deleteImageFromUrl(imageUrl);
        } catch {
            // 清不掉不影響主流程
        }
    }
};

// ===== 表情反饋（彈幕風格） =====

export const REACTION_EMOJIS = ["👍", "❤️", "😮", "🤔", "🎉"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

// 學生送出一個表情（client side debounce 由呼叫方做）
export const addReaction = async (questionId: string, emoji: string) => {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("未登入");
    await addDoc(collection(db, "reactions"), {
        questionId,
        emoji,
        userId,
        createdAt: serverTimestamp(),
    });
};

// 訂閱某題目最近 30 秒內的表情（給課堂模式飛行動畫用）
export const listenToReactions = (
    questionId: string,
    callback: (reactions: Array<{ id: string; emoji: string; userId: string }>) => void
) => {
    const sinceTs = Timestamp.fromMillis(Date.now() - 30 * 1000);
    const q = query(
        collection(db, "reactions"),
        where("questionId", "==", questionId),
        where("createdAt", ">=", sinceTs),
        orderBy("createdAt", "asc")
    );
    return onSnapshot(q, (snap) => {
        callback(
            snap.docs.map((d) => {
                const data = d.data() as any;
                return { id: d.id, emoji: data.emoji, userId: data.userId };
            })
        );
    });
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
