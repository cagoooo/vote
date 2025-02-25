import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Question, Vote } from "@shared/schema";
import { useParams } from "wouter";

export default function Student() {
  const { toast } = useToast();
  const params = useParams<{ id: string }>();
  const questionId = params.id;
  const [hasVoted, setHasVoted] = useState(false);

  // 檢查是否已經投票
  useEffect(() => {
    if (questionId) {
      const voted = localStorage.getItem(`voted_${questionId}`);
      if (voted) {
        setHasVoted(true);
      }
    }
  }, [questionId]);

  // 獲取問題數據
  const { data: question, isError } = useQuery<Question>({
    queryKey: [questionId ? `/api/questions/${questionId}` : "/api/questions/active"],
  });

  // 獲取投票結果
  const { data: votes = [] } = useQuery<Vote[]>({
    queryKey: [`/api/questions/${questionId}/votes`],
    refetchInterval: hasVoted ? 1000 : false, // 只有在顯示結果時才自動更新
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
      // 記錄投票狀態
      if (questionId) {
        localStorage.setItem(`voted_${questionId}`, "true");
        setHasVoted(true);
      }
    },
  });

  if (isError) {
    return (
      <div className="container mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold">無法載入問題</h1>
        <p className="text-muted-foreground mt-2">
          請確認連結是否正確
        </p>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="container mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold">目前沒有活動的問題</h1>
        <p className="text-muted-foreground mt-2">
          請等待老師建立新的問題
        </p>
      </div>
    );
  }

  // 計算投票結果
  const totals = votes.reduce((acc, vote) => {
    acc[vote.optionIndex] = (acc[vote.optionIndex] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  const totalVotes = votes.length;

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Card className="overflow-hidden">
        <img
          src={question.imageUrl}
          alt="問題圖片"
          className="w-full h-auto"
        />

        <div className="p-6 space-y-4">
          {hasVoted ? (
            // 顯示投票結果
            <div className="space-y-4">
              <h2 className="text-lg font-semibold mb-4">投票結果</h2>
              {question.options.map((option, index) => {
                const count = totals[index] || 0;
                const percentage = totalVotes ? (count / totalVotes) * 100 : 0;

                return (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between">
                      <span>{option}</span>
                      <span>{count} 票</span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                );
              })}
              <p className="mt-4 text-sm text-muted-foreground">
                總投票數：{totalVotes}
              </p>
            </div>
          ) : (
            // 顯示投票選項
            <div className="grid gap-2">
              {question.options.map((option, index) => (
                <Button
                  key={index}
                  onClick={() => vote.mutate(index)}
                  disabled={vote.isPending || hasVoted}
                  variant="outline"
                  className="h-12"
                >
                  {option}
                </Button>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}