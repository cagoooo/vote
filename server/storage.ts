import { type Question, type InsertQuestion, type Vote } from "@shared/schema";

export interface IStorage {
  createQuestion(question: InsertQuestion): Promise<Question>;
  getQuestion(id: number): Promise<Question | undefined>;
  getActiveQuestion(): Promise<Question | undefined>;
  addVote(questionId: number, optionIndex: number): Promise<Vote>;
  getVotesForQuestion(questionId: number): Promise<Vote[]>;
  resetVotes(questionId: number): Promise<void>;
}

export class MemStorage implements IStorage {
  private questions: Map<number, Question>;
  private votes: Map<number, Vote>;
  private currentQuestionId: number;
  private currentVoteId: number;

  constructor() {
    this.questions = new Map();
    this.votes = new Map();
    this.currentQuestionId = 1;
    this.currentVoteId = 1;
  }

  async createQuestion(insertQuestion: InsertQuestion): Promise<Question> {
    // Deactivate any existing active questions
    for (const [, question] of this.questions) {
      question.active = false;
    }

    const id = this.currentQuestionId++;
    const question: Question = {
      id,
      imageUrl: insertQuestion.imageUrl,
      options: [...insertQuestion.options],
      active: true,
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
    for (const [id, vote] of this.votes) {
      if (vote.questionId === questionId) {
        this.votes.delete(id);
      }
    }
  }
}

export const storage = new MemStorage();