/**
 * 本地投票管理模組
 * 用於 GitHub Pages 純前端部署
 * 使用 localStorage 儲存問題與投票
 * 使用 URL 參數分享投票連結
 */

export interface LocalQuestion {
    id: string;
    imageUrl: string;
    options: string[];
    active: boolean;
    correctAnswer: number | null;
    showAnswer: boolean;
    createdAt: number;
}

export interface LocalVote {
    id: number;
    questionId: string;
    optionIndex: number;
    timestamp: number;
}

// Storage keys
const QUESTIONS_KEY = 'voting_questions';
const VOTES_KEY = 'voting_votes';
const VOTED_PREFIX = 'voted_';

// 生成隨機 ID
function generateId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 8);
    return `${timestamp}${randomPart}`;
}

// 讀取所有問題
function getQuestions(): Map<string, LocalQuestion> {
    try {
        const data = localStorage.getItem(QUESTIONS_KEY);
        if (data) {
            const arr = JSON.parse(data) as [string, LocalQuestion][];
            return new Map(arr);
        }
    } catch (e) {
        console.error('Error reading questions:', e);
    }
    return new Map();
}

// 儲存所有問題
function saveQuestions(questions: Map<string, LocalQuestion>): void {
    localStorage.setItem(QUESTIONS_KEY, JSON.stringify(Array.from(questions.entries())));
}

// 讀取所有投票
function getVotes(): LocalVote[] {
    try {
        const data = localStorage.getItem(VOTES_KEY);
        if (data) {
            return JSON.parse(data) as LocalVote[];
        }
    } catch (e) {
        console.error('Error reading votes:', e);
    }
    return [];
}

// 儲存所有投票
function saveVotes(votes: LocalVote[]): void {
    localStorage.setItem(VOTES_KEY, JSON.stringify(votes));
}

// 建立問題
export function createQuestion(imageUrl: string, options: string[]): LocalQuestion {
    const questions = getQuestions();

    // 將所有現有問題設為非活動
    questions.forEach((q) => {
        q.active = false;
    });

    const id = generateId();
    const question: LocalQuestion = {
        id,
        imageUrl,
        options: [...options],
        active: true,
        correctAnswer: null,
        showAnswer: false,
        createdAt: Date.now(),
    };

    questions.set(id, question);
    saveQuestions(questions);

    return question;
}

// 取得問題
export function getQuestion(id: string): LocalQuestion | undefined {
    const questions = getQuestions();
    return questions.get(id);
}

// 取得活動問題
export function getActiveQuestion(): LocalQuestion | undefined {
    const questions = getQuestions();
    return Array.from(questions.values()).find(q => q.active);
}

// 投票
export function addVote(questionId: string, optionIndex: number): LocalVote | null {
    // 檢查是否已投票
    if (hasVoted(questionId)) {
        return null;
    }

    const votes = getVotes();
    const vote: LocalVote = {
        id: Date.now(),
        questionId,
        optionIndex,
        timestamp: Date.now(),
    };

    votes.push(vote);
    saveVotes(votes);

    // 記錄已投票
    localStorage.setItem(`${VOTED_PREFIX}${questionId}`, String(optionIndex));

    return vote;
}

// 檢查是否已投票
export function hasVoted(questionId: string): boolean {
    return localStorage.getItem(`${VOTED_PREFIX}${questionId}`) !== null;
}

// 取得問題的所有投票
export function getVotesForQuestion(questionId: string): LocalVote[] {
    const votes = getVotes();
    return votes.filter(v => v.questionId === questionId);
}

// 重置投票
export function resetVotes(questionId: string): void {
    const votes = getVotes();
    const filteredVotes = votes.filter(v => v.questionId !== questionId);
    saveVotes(filteredVotes);

    // 清除已投票記錄
    localStorage.removeItem(`${VOTED_PREFIX}${questionId}`);
}

// 設定正確答案
export function setCorrectAnswer(questionId: string, correctAnswer: number): LocalQuestion | null {
    const questions = getQuestions();
    const question = questions.get(questionId);

    if (!question) return null;

    question.correctAnswer = correctAnswer;
    questions.set(questionId, question);
    saveQuestions(questions);

    return question;
}

// 顯示/隱藏答案
export function toggleShowAnswer(questionId: string, show: boolean): LocalQuestion | null {
    const questions = getQuestions();
    const question = questions.get(questionId);

    if (!question) return null;

    question.showAnswer = show;
    questions.set(questionId, question);
    saveQuestions(questions);

    return question;
}

// 編碼問題到 URL
export function encodeQuestionToUrl(question: LocalQuestion): string {
    const data = {
        id: question.id,
        img: question.imageUrl,
        opts: question.options,
        ca: question.correctAnswer,
        sa: question.showAnswer,
    };
    return btoa(encodeURIComponent(JSON.stringify(data)));
}

// 從 URL 解碼問題
export function decodeQuestionFromUrl(encoded: string): Partial<LocalQuestion> | null {
    try {
        const json = decodeURIComponent(atob(encoded));
        const data = JSON.parse(json);
        return {
            id: data.id,
            imageUrl: data.img,
            options: data.opts,
            correctAnswer: data.ca,
            showAnswer: data.sa,
        };
    } catch (e) {
        console.error('Error decoding question:', e);
        return null;
    }
}

// 取得投票統計
export function getVoteStats(questionId: string): Record<number, number> {
    const votes = getVotesForQuestion(questionId);
    const stats: Record<number, number> = {};

    votes.forEach(vote => {
        stats[vote.optionIndex] = (stats[vote.optionIndex] || 0) + 1;
    });

    return stats;
}

// 清除所有資料
export function clearAllData(): void {
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key === QUESTIONS_KEY || key === VOTES_KEY || key.startsWith(VOTED_PREFIX))) {
            keysToRemove.push(key);
        }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
}
