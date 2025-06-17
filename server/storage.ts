import { type Question, type InsertQuestion, type Vote } from "@shared/schema";

export interface IStorage {
  createQuestion(question: InsertQuestion): Promise<Question>;
  getQuestion(id: number): Promise<Question | undefined>;
  getActiveQuestion(): Promise<Question | undefined>;
  addVote(questionId: number, optionIndex: number, sessionId?: string): Promise<Vote>;
  getVotesForQuestion(questionId: number): Promise<Vote[]>;
  hasUserVoted(questionId: number, sessionId: string): Promise<boolean>;
  resetVotes(questionId: number): Promise<void>;
  setCorrectAnswer(questionId: number, correctAnswer: number): Promise<Question>;
  showAnswer(questionId: number, show: boolean): Promise<Question>;
}

export class MemStorage implements IStorage {
  private questions: Map<number, Question>;
  private votes: Map<number, Vote>;
  private currentQuestionId: number;
  private currentVoteId: number;
  private userVotes: Map<string, Set<number>>; // sessionId -> Set of questionIds

  constructor() {
    this.questions = new Map();
    this.votes = new Map();
    this.currentQuestionId = 1;
    this.currentVoteId = 1;
    this.userVotes = new Map();
  }

  async createQuestion(insertQuestion: InsertQuestion): Promise<Question> {
    // Deactivate any existing active questions
    Array.from(this.questions.values()).forEach(question => {
      question.active = false;
    });

    const id = this.currentQuestionId++;
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

  async getQuestion(id: number): Promise<Question | undefined> {
    return this.questions.get(id);
  }

  async getActiveQuestion(): Promise<Question | undefined> {
    return Array.from(this.questions.values()).find((q) => q.active);
  }

  async addVote(questionId: number, optionIndex: number): Promise<Vote> {
    const id = this.currentVoteId++;
    const vote: Vote = { id, questionId, optionIndex };
    this.votes.set(id, vote);
    return vote;
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