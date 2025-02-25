import { pgTable, text, serial, integer, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  imageUrl: text("image_url").notNull(),
  options: jsonb("options").$type<string[]>().notNull(),
  active: boolean("active").notNull().default(true),
});

export const votes = pgTable("votes", {
  id: serial("id").primaryKey(),
  questionId: integer("question_id").notNull(),
  optionIndex: integer("option_index").notNull(),
});

export const insertQuestionSchema = createInsertSchema(questions).pick({
  imageUrl: true,
  options: true,
});

export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type Question = typeof questions.$inferSelect;
export type Vote = typeof votes.$inferSelect;