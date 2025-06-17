import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { insertQuestionSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express) {
  const httpServer = createServer(app);

  app.post("/api/questions", async (req, res) => {
    try {
      const question = insertQuestionSchema.parse(req.body);
      const created = await storage.createQuestion(question);
      res.json(created);
    } catch (error) {
      res.status(400).json({ error: "Invalid question data" });
    }
  });

  app.get("/api/questions/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const question = await storage.getQuestion(id);
    if (!question) {
      res.status(404).json({ error: "Question not found" });
      return;
    }
    res.json(question);
  });

  app.get("/api/questions/active", async (req, res) => {
    const question = await storage.getActiveQuestion();
    if (!question) {
      res.status(404).json({ error: "No active question" });
      return;
    }
    res.json(question);
  });

  app.post("/api/questions/:id/vote", async (req, res) => {
    const id = parseInt(req.params.id);
    const optionIndex = z.number().parse(req.body.optionIndex);

    const question = await storage.getQuestion(id);
    if (!question) {
      res.status(404).json({ error: "Question not found" });
      return;
    }

    if (optionIndex < 0 || optionIndex >= question.options.length) {
      res.status(400).json({ error: "Invalid option index" });
      return;
    }

    const vote = await storage.addVote(id, optionIndex);
    res.json(vote);
  });

  app.get("/api/questions/:id/votes", async (req, res) => {
    const id = parseInt(req.params.id);
    const votes = await storage.getVotesForQuestion(id);
    res.json(votes);
  });

  app.post("/api/questions/:id/reset-votes", async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.resetVotes(id);
    res.json({ success: true });
  });

  app.post("/api/questions/:id/correct-answer", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const correctAnswer = z.number().parse(req.body.correctAnswer);
      
      const question = await storage.getQuestion(id);
      if (!question) {
        res.status(404).json({ error: "Question not found" });
        return;
      }

      if (correctAnswer < 0 || correctAnswer >= question.options.length) {
        res.status(400).json({ error: "Invalid correct answer index" });
        return;
      }

      const updatedQuestion = await storage.setCorrectAnswer(id, correctAnswer);
      res.json(updatedQuestion);
    } catch (error) {
      res.status(400).json({ error: "Invalid data" });
    }
  });

  app.post("/api/questions/:id/show-answer", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const show = z.boolean().parse(req.body.show);
      
      const question = await storage.getQuestion(id);
      if (!question) {
        res.status(404).json({ error: "Question not found" });
        return;
      }

      const updatedQuestion = await storage.showAnswer(id, show);
      res.json(updatedQuestion);
    } catch (error) {
      res.status(400).json({ error: "Invalid data" });
    }
  });

  return httpServer;
}