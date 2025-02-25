import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Question } from "@shared/schema";

export default function Student() {
  const { toast } = useToast();
  const { data: question } = useQuery<Question>({
    queryKey: ["/api/questions/active"],
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
        title: "Vote submitted",
        description: "Thank you for voting!",
      });
    },
  });

  if (!question) {
    return (
      <div className="container mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold">No active question</h1>
        <p className="text-muted-foreground mt-2">
          Please wait for the teacher to create a new question
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Card className="overflow-hidden">
        <img
          src={question.imageUrl}
          alt="Question"
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
