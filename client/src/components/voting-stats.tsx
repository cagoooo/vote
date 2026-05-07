import { Card } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import * as firestore from "@/lib/firestore-voting";

interface VotingStatsProps {
  question: any;
  onVoteReceived?: (votes: any[]) => void;
}

// Playful Campus 選項色塊（與 teacher.tsx 同步）
const OPT_PALETTES = [
  { bg: "#FEE2E2", dot: "#EF4444" },
  { bg: "#DBEAFE", dot: "#3B82F6" },
  { bg: "#FEF3C7", dot: "#F59E0B" },
  { bg: "#D1FAE5", dot: "#10B981" },
  { bg: "#EDE9FE", dot: "#8B5CF6" },
  { bg: "#FCE7F3", dot: "#F472B6" },
];

// 投票學生用的可愛動物頭像（依答題人數依序顯示，最多 7 顆）
const ANIMAL_AVATARS = ["🦊", "🐼", "🐸", "🦁", "🐰", "🐯", "🐻", "🐨", "🐵", "🐱"];

export function VotingStats({ question, onVoteReceived }: VotingStatsProps) {
  const [totals, setTotals] = useState<Record<number, number>>({});
  const [totalVoters, setTotalVoters] = useState(0);

  // 監聽投票統計
  useEffect(() => {
    if (question?.id) {
      const unsubscribe = firestore.getVotesStats(question.id, (stats, voters) => {
        setTotals(stats);
        setTotalVoters(voters);
        if (onVoteReceived) {
          onVoteReceived(new Array(voters).fill({}));
        }
      });
      return () => unsubscribe();
    }
  }, [question?.id, onVoteReceived]);

  // 多選題：correctAnswers 是陣列；單選題：correctAnswer 是 number
  const isMulti = question.questionType === "multiple";
  const isCorrectIndex = (idx: number) => {
    if (!question.showAnswer) return false;
    if (isMulti) {
      return Array.isArray(question.correctAnswers) && question.correctAnswers.includes(idx);
    }
    return question.correctAnswer === idx;
  };

  // 為了長條的「相對寬度」，找出當前最高票
  const counts = question.options.map((_: string, i: number) => totals[i] || 0);
  const maxCount = Math.max(1, ...counts);
  const totalVotes = counts.reduce((a: number, b: number) => a + b, 0);

  return (
    <Card className="p-5 sm:p-6 rounded-3xl border-0 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
      {/* 標題列：即時票數 + 總人數 */}
      <div className="flex items-baseline justify-between mb-4">
        <div className="text-sm font-extrabold text-slate-900">即時票數</div>
        <div className="text-3xl font-extrabold text-blue-600 tabular-nums">
          {totalVoters}
          <span className="text-sm text-slate-500 font-semibold ml-1">人</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <AnimatePresence>
          {question.options.map((option: string, index: number) => {
            const palette = OPT_PALETTES[index % OPT_PALETTES.length];
            const count = counts[index];
            const pct = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
            const widthRel = (count / maxCount) * 100;
            const isCorrect = isCorrectIndex(index);
            return (
              <motion.div
                key={index}
                layout
                initial={{ x: -10, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: index * 0.05 }}
                className="rounded-2xl p-3 transition-all"
                style={{
                  background: isCorrect ? "#D1FAE5" : "#FAFAFA",
                  border: isCorrect ? `2px solid #10B981` : "2px solid transparent",
                }}
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <span
                    className="playful-letter w-7 h-7 text-xs"
                    style={{ background: palette.dot }}
                    aria-hidden
                  >
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span className="flex-1 text-sm sm:text-[15px] font-bold text-slate-900 break-words leading-snug">
                    {option}
                  </span>
                  {isCorrect && (
                    <span className="text-[11px] px-2 py-0.5 bg-emerald-500 text-white rounded-full font-extrabold flex items-center gap-0.5 flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3" />正解
                    </span>
                  )}
                  <motion.span
                    key={`count-${count}`}
                    initial={{ scale: 1.4, color: palette.dot }}
                    animate={{ scale: 1, color: "#0F172A" }}
                    transition={{ type: "spring", stiffness: 200, damping: 12 }}
                    className="text-base font-extrabold tabular-nums flex-shrink-0"
                  >
                    {count}
                  </motion.span>
                  <span className="text-xs font-bold text-slate-500 min-w-[36px] text-right tabular-nums flex-shrink-0">
                    {pct}%
                  </span>
                </div>
                <div className="h-3 rounded-full overflow-hidden bg-white shadow-inner">
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${widthRel}%` }}
                    transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                    style={{ background: `linear-gradient(90deg, ${palette.dot}, ${palette.dot}CC)` }}
                  />
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* 已投票學生 — 動物頭像群（最多 7 顆 + 多餘人數計數） */}
      <div className="mt-4 px-3 py-2.5 bg-slate-50 rounded-2xl flex justify-between items-center">
        <span className="text-xs text-slate-500 font-semibold">已投票學生</span>
        <div className="flex items-center">
          {ANIMAL_AVATARS.slice(0, Math.min(7, totalVoters)).map((emoji, i) => (
            <span
              key={i}
              className="w-7 h-7 rounded-full bg-white grid place-items-center text-sm shadow-sm"
              style={{
                marginLeft: i ? -8 : 0,
                border: "2px solid #fff",
                zIndex: 7 - i,
              }}
            >
              {emoji}
            </span>
          ))}
          {totalVoters > 7 && (
            <span className="ml-2 text-xs font-bold text-slate-500 tabular-nums">+{totalVoters - 7}</span>
          )}
          {totalVoters === 0 && (
            <span className="text-xs text-slate-400">等待投票…</span>
          )}
        </div>
      </div>
    </Card>
  );
}
