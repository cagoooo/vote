import { useQuery } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import type { Question, Vote } from "@shared/schema";

interface VotingStatsProps {
  question: Question;
}

export function VotingStats({ question }: VotingStatsProps) {
  const { data: votes = [] } = useQuery<Vote[]>({
    queryKey: [`/api/questions/${question.id}/votes`],
    refetchInterval: 1000,
  });

  const totals = votes.reduce((acc, vote) => {
    acc[vote.optionIndex] = (acc[vote.optionIndex] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  const totalVotes = votes.length;

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-4">即時投票結果</h2>
      <div className="space-y-4">
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
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        總投票數：{totalVotes}
      </p>
    </Card>
  );
}