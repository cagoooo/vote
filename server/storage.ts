import { type Question, type InsertQuestion, type Vote } from "@shared/schema";

export interface IStorage {
  createQuestion(question: InsertQuestion): Promise<Question>;
  getQuestion(id: string): Promise<Question | undefined>;
  getActiveQuestion(): Promise<Question | undefined>;
  addVote(questionId: string, optionIndex: number, sessionId?: string): Promise<Vote>;
  getVotesForQuestion(questionId: string): Promise<Vote[]>;
  hasUserVoted(questionId: string, sessionId: string): Promise<boolean>;
  resetVotes(questionId: string): Promise<void>;
  setCorrectAnswer(questionId: string, correctAnswer: number): Promise<Question>;
  showAnswer(questionId: string, show: boolean): Promise<Question>;
}

// 生成隨機流水號
function generateRandomId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `${timestamp}${randomPart}`;
}

export class MemStorage implements IStorage {
  private questions: Map<string, Question>;
  private votes: Map<number, Vote>;
  private currentVoteId: number;
  private userVotes: Map<string, Set<string>>; // sessionId -> Set of questionIds

  constructor() {
    this.questions = new Map();
    this.votes = new Map();
    this.currentVoteId = 1;
    this.userVotes = new Map();
  }

  async createQuestion(insertQuestion: InsertQuestion): Promise<Question> {
    // Deactivate any existing active questions
    Array.from(this.questions.values()).forEach(question => {
      question.active = false;
    });

    const id = generateRandomId();
    const question: Question = {
      id,
      imageUrl: insertQuestion.imageUrl,
      options: [...insertQuestion.options],
      active: true,
      correctAnswer: null,
      showAnswer: false,
    };
    this.questions.set(id, question);
    return question;
  }

  async getQuestion(id: string): Promise<Question | undefined> {
    return this.questions.get(id);
  }

  async getActiveQuestion(): Promise<Question | undefined> {
    return Array.from(this.questions.values()).find((q) => q.active);
  }

  async addVote(questionId: string, optionIndex: number, sessionId?: string): Promise<Vote> {
    const id = this.currentVoteId++;
    const vote: Vote = { id, questionId, optionIndex, sessionId: sessionId || null };
    this.votes.set(id, vote);
    
    // Track this vote for duplicate prevention
    if (sessionId) {
      if (!this.userVotes.has(sessionId)) {
        this.userVotes.set(sessionId, new Set());
      }
      this.userVotes.get(sessionId)!.add(questionId);
    }
    
    return vote;
  }

  async hasUserVoted(questionId: string, sessionId: string): Promise<boolean> {
    const userQuestions = this.userVotes.get(sessionId);
    return userQuestions ? userQuestions.has(questionId) : false;
  }

  async getVotesForQuestion(questionId: number): Promise<Vote[]> {
    return Array.from(this.votes.values()).filter(
      (vote) => vote.questionId === questionId
    );
  }

  async resetVotes(questionId: number): Promise<void> {
    // 移除特定問題的所有投票
    const votesToDelete: number[] = [];
    this.votes.forEach((vote, id) => {
      if (vote.questionId === questionId) {
        votesToDelete.push(id);
      }
    });
    votesToDelete.forEach(id => this.votes.delete(id));
    
    // 清除用戶投票追蹤記錄
    this.userVotes.forEach((questionIds, sessionId) => {
      questionIds.delete(questionId);
    });
  }

  async setCorrectAnswer(questionId: number, correctAnswer: number): Promise<Question> {
    const question = this.questions.get(questionId);
    if (!question) {
      throw new Error(`Question with id ${questionId} not found`);
    }
    
    question.correctAnswer = correctAnswer;
    this.questions.set(questionId, question);
    return question;
  }

  async showAnswer(questionId: number, show: boolean): Promise<Question> {
    const question = this.questions.get(questionId);
    if (!question) {
      throw new Error(`Question with id ${questionId} not found`);
    }
    
    question.showAnswer = show;
    this.questions.set(questionId, question);
    return question;
  }
}

export const storage = new MemStorage();