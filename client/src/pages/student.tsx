import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Question, Vote } from "@shared/schema";
import { useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

export default function Student() {
  const { toast } = useToast();
  const params = useParams<{ id: string }>();
  const questionId = params.id;
  const [hasVoted, setHasVoted] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [animatedCounts, setAnimatedCounts] = useState<Record<number, number>>({});

  // 獲取問題數據
  const { data: question } = useQuery<Question>({
    queryKey: [questionId ? `/api/questions/${questionId}` : "/api/questions/active"],
  });

  // 檢查是否已經投票，並處理重置情況
  useEffect(() => {
    if (questionId && question) {
      if (question.active) {
        localStorage.removeItem(`voted_${questionId}`);
        setHasVoted(false);
      } else {
        const voted = localStorage.getItem(`voted_${questionId}`);
        setHasVoted(!!voted);
      }
    }
  }, [questionId, question]);

  // 獲取投票結果
  const { data: votes = [] } = useQuery<Vote[]>({
    queryKey: [`/api/questions/${questionId}/votes`],
    refetchInterval: hasVoted ? 1000 : false,
  });

  // 處理動畫計數
  useEffect(() => {
    if (hasVoted) {
      const totals = votes.reduce((acc, vote) => {
        acc[vote.optionIndex] = (acc[vote.optionIndex] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);

      // 為每個選項創建動畫計數
      Object.entries(totals).forEach(([optionIndex, count]) => {
        const startValue = animatedCounts[Number(optionIndex)] || 0;
        const steps = 20; // 動畫步驟數
        const increment = (count - startValue) / steps;
        let currentStep = 0;

        const interval = setInterval(() => {
          if (currentStep < steps) {
            setAnimatedCounts(prev => ({
              ...prev,
              [Number(optionIndex)]: Math.round(startValue + increment * currentStep)
            }));
            currentStep++;
          } else {
            clearInterval(interval);
            setAnimatedCounts(prev => ({
              ...prev,
              [Number(optionIndex)]: count
            }));
          }
        }, 50);

        return () => clearInterval(interval);
      });
    }
  }, [votes, hasVoted]);

  const vote = useMutation({
    mutationFn: async (optionIndex: number) => {
      if (!question) return;
      await apiRequest("POST", `/api/questions/${question.id}/vote`, {
        optionIndex,
      });
    },
    onSuccess: () => {
      toast({
        title: "投票成功",
        description: "感謝您的參與！",
      });
      if (questionId) {
        localStorage.setItem(`voted_${questionId}`, "true");
        setHasVoted(true);
      }
    },
  });

  if (!question) {
    return (
      <div className="page-container text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-2xl font-bold gradient-text">目前沒有活動的問題</h1>
          <p className="text-muted-foreground mt-2">
            請等待老師建立新的問題
          </p>
        </motion.div>
      </div>
    );
  }

  const totals = votes.reduce((acc, vote) => {
    acc[vote.optionIndex] = (acc[vote.optionIndex] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  const totalVotes = votes.length;
  const maxVotes = Math.max(...Object.values(totals));

  return (
    <div className="page-container max-w-2xl">
      <Card className="overflow-hidden card-hover">
        <motion.img
          src={question.imageUrl}
          alt="問題圖片"
          className="w-full h-auto"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        />

        <div className="p-6 space-y-4">
          <AnimatePresence mode="wait">
            {hasVoted ? (
              <motion.div
                className="space-y-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
              >
                <h2 className="text-xl font-semibold mb-4 gradient-text">投票結果</h2>
                {question.options.map((option, index) => {
                  const count = totals[index] || 0;
                  const percentage = totalVotes ? (count / totalVotes) * 100 : 0;
                  const isWinning = count === maxVotes && count > 0;

                  return (
                    <motion.div
                      key={index}
                      className="space-y-2"
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className={isWinning ? "font-bold text-primary" : ""}>
                          {option}
                          {isWinning && (
                            <motion.span
                              className="inline-block ml-2"
                              animate={{ rotate: [0, 10, -10, 0] }}
                              transition={{ duration: 0.5, repeat: Infinity }}
                            >
                              🌟
                            </motion.span>
                          )}
                        </span>
                        <motion.span
                          className="font-semibold"
                          key={`count-${count}`}
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: "spring", stiffness: 200, damping: 10 }}
                        >
                          {animatedCounts[index] || 0} 票
                        </motion.span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <motion.div
                            className="h-2 bg-primary/20 rounded-full overflow-hidden"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.5 }}
                          >
                            <motion.div
                              className="h-full bg-primary"
                              initial={{ width: "0%" }}
                              animate={{ width: `${percentage}%` }}
                              transition={{ duration: 0.8, ease: "easeOut" }}
                            />
                          </motion.div>
                        </div>
                        <motion.span
                          className="text-sm text-muted-foreground min-w-[4rem] text-right"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.5, delay: 0.2 }}
                        >
                          {percentage.toFixed(1)}%
                        </motion.span>
                      </div>
                    </motion.div>
                  );
                })}
                <motion.p
                  className="mt-6 text-sm text-muted-foreground text-center"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.5 }}
                >
                  總投票數：{totalVotes}
                </motion.p>
              </motion.div>
            ) : (
              <motion.div
                className="grid gap-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
              >
                <h2 className="text-xl font-semibold gradient-text text-center mb-2">
                  請選擇您的答案
                </h2>
                {question.options.map((option, index) => (
                  <motion.div
                    key={index}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Button
                      onClick={() => {
                        setSelectedOption(index);
                        vote.mutate(index);
                      }}
                      disabled={vote.isPending || hasVoted}
                      variant={selectedOption === index ? "default" : "outline"}
                      className={`w-full h-12 text-lg transition-all duration-300 relative overflow-hidden ${
                        selectedOption === index
                          ? "bg-primary text-primary-foreground transform hover:scale-[1.02] hover:shadow-lg"
                          : "hover:bg-primary/10 hover:border-primary/50"
                      }`}
                      asChild
                    >
                      <motion.div
                        whileHover={{
                          scale: 1.02,
                          transition: { duration: 0.2 }
                        }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="relative z-10 flex items-center justify-center gap-2">
                          {option}
                          <motion.div
                            className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/10 to-primary/0"
                            animate={{
                              x: ["0%", "100%"],
                            }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                              ease: "linear",
                            }}
                            style={{ opacity: selectedOption === index ? 0 : 1 }}
                          />
                        </div>
                      </motion.div>
                    </Button>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>
    </div>
  );
}