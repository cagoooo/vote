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

  return httpServer;
}
