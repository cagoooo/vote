import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion, useAnimation, AnimatePresence } from "framer-motion";
import { BarChart, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import * as firestore from "@/lib/firestore-voting";

interface VotingStatsProps {
  question: any;
  onVoteReceived?: (votes: any[]) => void;
}

// 預定義的漸層色彩配置，增加飽和度
const gradients = [
  "from-blue-600 to-cyan-400",
  "from-purple-600 to-pink-400",
  "from-green-600 to-emerald-400",
  "from-orange-600 to-yellow-400",
  "from-red-600 to-rose-400",
  "from-indigo-600 to-blue-400",
];

export function VotingStats({ question, onVoteReceived }: VotingStatsProps) {
  const [totals, setTotals] = useState<Record<number, number>>({});
  const [totalVotes, setTotalVotes] = useState(0);
  const [animatedPercentages, setAnimatedPercentages] = useState<Record<number, number>>({});
  const controls = useAnimation();

  // 監聽投票統計
  useEffect(() => {
    if (question?.id) {
      const unsubscribe = firestore.getVotesStats(question.id, (stats) => {
        setTotals(stats);
        const total = Object.values(stats).reduce((a, b) => a + b, 0);
        setTotalVotes(total);

        if (onVoteReceived) {
          // 為了相容性，傳遞一個模擬的 votes 陣列
          onVoteReceived(new Array(total).fill({}));
        }
      });
      return () => unsubscribe();
    }
  }, [question?.id, onVoteReceived]);

  // Animate percentages when votes change
  useEffect(() => {
    question.options.forEach((_: string, index: number) => {
      const count = totals[index] || 0;
      const targetPercentage = totalVotes ? (count / totalVotes) * 100 : 0;

      // Animate from current to target percentage
      const startPercentage = animatedPercentages[index] || 0;
      let frame = startPercentage;

      const animate = () => {
        if (frame < targetPercentage) {
          frame = Math.min(frame + 1, targetPercentage);
          setAnimatedPercentages(prev => ({
            ...prev,
            [index]: Number(frame.toFixed(1))
          }));
          if (frame < targetPercentage) {
            requestAnimationFrame(animate);
          }
        } else if (frame > targetPercentage) {
          frame = Math.max(frame - 1, targetPercentage);
          setAnimatedPercentages(prev => ({
            ...prev,
            [index]: Number(frame.toFixed(1))
          }));
          if (frame > targetPercentage) {
            requestAnimationFrame(animate);
          }
        }
      };

      requestAnimationFrame(animate);
    });
  }, [totals, totalVotes]);

  useEffect(() => {
    controls.start("visible");
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: {
      opacity: 0,
      x: -20,
      scale: 0.95
    },
    visible: {
      opacity: 1,
      x: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 10
      }
    }
  };

  return (
    <Card className="p-6 card-hover">
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex items-center gap-2 mb-4"
      >
        <BarChart className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-semibold gradient-text">即時投票結果</h2>
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate={controls}
        className="space-y-6"
      >
        <AnimatePresence>
          {question.options.map((option: string, index: number) => {
            const count = totals[index] || 0;
            const percentage = animatedPercentages[index] || 0;
            const gradientClass = gradients[index % gradients.length];

            return (
              <motion.div
                key={index}
                variants={itemVariants}
                layout
                className="space-y-2"
              >
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-2">
                    <motion.span
                      className={`font-medium text-base bg-gradient-to-r ${gradientClass} bg-clip-text text-transparent`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      {option}
                    </motion.span>
                    {question.showAnswer && question.correctAnswer === index && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 300, delay: 0.2 }}
                      >
                        <Badge variant="default" className="bg-green-100 text-green-800 border-green-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          正確答案
                        </Badge>
                      </motion.div>
                    )}
                  </div>
                  <motion.span
                    className={`font-bold text-lg bg-gradient-to-r ${gradientClass} bg-clip-text text-transparent`}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200 }}
                  >
                    {count} 票
                  </motion.span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <motion.div
                      initial={{ scale: 0, originX: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      className="relative h-2 overflow-hidden rounded-full bg-secondary"
                    >
                      <motion.div
                        className={`absolute top-0 left-0 h-full bg-gradient-to-r ${gradientClass} shadow-lg`}
                        style={{ width: `${percentage}%` }}
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </motion.div>
                  </div>
                  <motion.span
                    className={`text-base font-bold bg-gradient-to-r ${gradientClass} bg-clip-text text-transparent min-w-[4rem] text-right`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: index * 0.1 + 0.2 }}
                  >
                    {percentage.toFixed(1)}%
                  </motion.span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>

      <motion.p
        className="mt-6 text-sm text-center bg-primary/10 py-2 px-4 rounded-full font-medium"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        總投票數：<span className="font-bold text-base text-primary">{totalVotes}</span>
      </motion.p>
    </Card>
  );
}