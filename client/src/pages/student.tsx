import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Question, Vote } from "@shared/schema";
import { useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Student() {
  const { toast } = useToast();
  const params = useParams<{ id: string }>();
  const questionId = params.id;
  const queryClient = useQueryClient();
  const [hasVoted, setHasVoted] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [animatedCounts, setAnimatedCounts] = useState<Record<number, number>>({});

  // 獲取問題數據，包括正確答案狀態
  const { data: question } = useQuery<Question>({
    queryKey: [questionId ? `/api/questions/${questionId}` : "/api/questions/active"],
    refetchInterval: 1000, // 持續檢查正確答案狀態更新
  });

  // 檢查是否已經投票，並處理重置情況
  useEffect(() => {
    if (questionId && question) {
      // 只在問題真正重置時才清除投票狀態
      // 如果只是答案顯示狀態改變，保持投票狀態
      const voted = localStorage.getItem(`voted_${questionId}`);
      if (voted && voted !== "true") {
        // 如果localStorage存儲的是選項索引
        const optionIndex = parseInt(voted);
        setHasVoted(true);
        setSelectedOption(optionIndex);
      } else if (voted === "true") {
        // 兼容舊格式，但需要從投票記錄中恢復選項
        setHasVoted(true);
        setSelectedOption(null);
      } else {
        setHasVoted(false);
        setSelectedOption(null);
      }
    }
  }, [questionId]); // 移除 question 依賴，避免答案狀態更新時重置投票

  // 獲取投票結果
  const { data: votes = [] } = useQuery<Vote[]>({
    queryKey: [`/api/questions/${questionId}/votes`],
    refetchInterval: 1000, // 始終檢查投票更新，不論是否已投票
  });

  // 檢測投票是否被重置（老師重置投票時）
  useEffect(() => {
    if (hasVoted && votes.length === 0 && questionId) {
      // 如果用戶已投票但投票數據為空，表示投票被重置
      localStorage.removeItem(`voted_${questionId}`);
      setHasVoted(false);
      setSelectedOption(null);
    }
  }, [votes, hasVoted, questionId]);

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
      
      // 先設置投票狀態，防止重複投票
      if (questionId) {
        localStorage.setItem(`voted_${questionId}`, optionIndex.toString());
        setHasVoted(true);
        setSelectedOption(optionIndex);
      }
      
      await apiRequest("POST", `/api/questions/${question.id}/vote`, {
        optionIndex,
      });
    },
    onSuccess: () => {
      toast({
        title: "投票成功",
        description: "感謝您的參與！",
      });
      
      // 手動觸發投票數據重新獲取
      queryClient.invalidateQueries({ queryKey: [`/api/questions/${questionId}/votes`] });
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-2 sm:p-4">
      <div className="max-w-2xl mx-auto">
        <Card className="overflow-hidden shadow-xl border-0 bg-white/95 backdrop-blur-sm">
          <div className="relative">
            <motion.img
              src={question.imageUrl}
              alt="問題圖片"
              className="w-full h-auto max-h-[50vh] object-contain bg-gray-50"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            />
            <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 text-sm font-medium text-gray-600 shadow-lg">
              即時投票
            </div>
          </div>

          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            <AnimatePresence mode="wait">
            {hasVoted ? (
              <motion.div
                className="space-y-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div className="text-center mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold gradient-text mb-2">投票結果</h2>
                  <p className="text-sm text-muted-foreground">
                    即時更新中...
                  </p>
                </div>
                {question.options.map((option, index) => {
                  const count = totals[index] || 0;
                  const percentage = totalVotes ? (count / totalVotes) * 100 : 0;
                  const isWinning = count === maxVotes && count > 0;

                  return (
                    <motion.div
                      key={index}
                      className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-all duration-200"
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isWinning ? "bg-primary text-primary-foreground" : "bg-gray-100 text-gray-600"
                          }`}>
                            <span className="text-sm font-bold">{index + 1}</span>
                          </div>
                          <span className={`text-sm sm:text-base font-medium break-words leading-tight ${
                            isWinning ? "text-primary font-bold" : "text-gray-800"
                          }`}>
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
                          {question.showAnswer && question.correctAnswer === index && (
                            <motion.div
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ type: "spring", stiffness: 300, delay: 0.2 }}
                              className="flex-shrink-0"
                            >
                              <Badge variant="default" className="bg-green-100 text-green-800 border-green-300 flex items-center gap-1 text-xs">
                                <CheckCircle2 className="w-3 h-3" />
                                正確答案
                              </Badge>
                            </motion.div>
                          )}
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <motion.span
                            className={`font-bold text-lg ${isWinning ? "text-primary" : "text-gray-700"}`}
                            key={`count-${count}`}
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: "spring", stiffness: 200, damping: 10 }}
                          >
                            {animatedCounts[index] || 0} 票
                          </motion.span>
                          <motion.span
                            className="text-sm text-muted-foreground font-medium"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                          >
                            ({percentage.toFixed(1)}%)
                          </motion.span>
                        </div>
                      </div>
                      <div className="mt-3">
                        <motion.div
                          className="h-3 bg-gray-100 rounded-full overflow-hidden"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.5 }}
                        >
                          <motion.div
                            className={`h-full rounded-full ${
                              isWinning ? "bg-gradient-to-r from-primary to-primary/80" : "bg-primary/70"
                            }`}
                            initial={{ width: "0%" }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                          />
                        </motion.div>
                      </div>
                    </motion.div>
                  );
                })}
                <motion.div
                  className="mt-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.5 }}
                >
                  <div className="flex items-center justify-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-full">
                      <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-700">總投票數</p>
                      <p className="text-xl font-bold text-blue-600">{totalVotes}</p>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                className="space-y-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div className="text-center mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold gradient-text mb-2">
                    請選擇您的答案
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    點擊選項進行投票
                  </p>
                </div>
                <div className="grid gap-3 sm:gap-4">
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
                      className={`w-full h-14 sm:h-12 text-base sm:text-lg font-medium transition-all duration-300 relative overflow-hidden touch-manipulation ${
                        selectedOption === index
                          ? "bg-primary text-primary-foreground transform hover:scale-[1.02] hover:shadow-lg shadow-md"
                          : "hover:bg-primary/10 hover:border-primary/50 active:bg-primary/5"
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
                          <span>{option}</span>
                          {question.showAnswer && question.correctAnswer === index && (
                            <motion.div
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ type: "spring", stiffness: 300, delay: 0.2 }}
                            >
                              <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-300 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                正確
                              </Badge>
                            </motion.div>
                          )}
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
                </div>
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        </Card>
      </div>
    </div>
  );
}