import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Question } from "@shared/schema";
import { useParams } from "wouter";

export default function Student() {
  const { toast } = useToast();
  const params = useParams<{ id: string }>();
  const questionId = params.id;

  // 如果有指定ID，就獲取特定問題，否則獲取當前活動的問題
  const { data: question, isError } = useQuery<Question>({
    queryKey: [questionId ? `/api/questions/${questionId}` : "/api/questions/active"],
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

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Card className="overflow-hidden">
        <img
          src={question.imageUrl}
          alt="問題圖片"
          className="w-full h-auto"
        />

        <div className="p-6 space-y-4">
          <div className="grid gap-2">
            {question.options.map((option, index) => (
              <Button
                key={index}
                onClick={() => vote.mutate(index)}
                disabled={vote.isPending}
                variant="outline"
                className="h-12"
              >
                {option}
              </Button>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}