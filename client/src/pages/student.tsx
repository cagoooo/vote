import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Question, Vote } from "@shared/schema";
import { useParams } from "wouter";
import { motion } from "framer-motion";

export default function Student() {
  const { toast } = useToast();
  const params = useParams<{ id: string }>();
  const questionId = params.id;
  const [hasVoted, setHasVoted] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  // 獲取問題數據
  const { data: question } = useQuery<Question>({
    queryKey: [questionId ? `/api/questions/${questionId}` : "/api/questions/active"],
  });

  // 檢查是否已經投票，並處理重置情況
  useEffect(() => {
    if (questionId && question) {
      // 如果問題是活動的（新的或重置的），清除之前的投票記錄
      if (question.active) {
        localStorage.removeItem(`voted_${questionId}`);
        setHasVoted(false);
      } else {
        // 檢查是否已經為這個問題投票
        const voted = localStorage.getItem(`voted_${questionId}`);
        setHasVoted(!!voted);
      }
    }
  }, [questionId, question]); // 當 questionId 或 question 改變時重新檢查

  // 獲取投票結果
  const { data: votes = [] } = useQuery<Vote[]>({
    queryKey: [`/api/questions/${questionId}/votes`],
    refetchInterval: hasVoted ? 1000 : false,
  });

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

  return (
    <div className="page-container max-w-2xl">
      <Card className="overflow-hidden card-hover">
        <img
          src={question.imageUrl}
          alt="問題圖片"
          className="w-full h-auto animate-fade-in"
        />

        <div className="p-6 space-y-4">
          {hasVoted ? (
            <motion.div
              className="space-y-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-xl font-semibold mb-4 gradient-text">投票結果</h2>
              {question.options.map((option, index) => {
                const count = totals[index] || 0;
                const percentage = totalVotes ? (count / totalVotes) * 100 : 0;

                return (
                  <motion.div
                    key={index}
                    className="space-y-2"
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span>{option}</span>
                      <span className="font-semibold">{count} 票</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <Progress value={percentage} className="h-2" />
                      </div>
                      <span className="text-sm text-muted-foreground min-w-[4rem] text-right">
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                  </motion.div>
                );
              })}
              <p className="mt-6 text-sm text-muted-foreground text-center">
                總投票數：{totalVotes}
              </p>
            </motion.div>
          ) : (
            <motion.div
              className="grid gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
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
                    className={`w-full h-12 text-lg transition-all duration-300 ${
                      selectedOption === index
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-primary/10"
                    }`}
                  >
                    {option}
                  </Button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </Card>
    </div>
  );
}