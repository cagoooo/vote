import { useQuery } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import type { Question, Vote } from "@shared/schema";
import { motion } from "framer-motion";
import { BarChart } from "lucide-react";

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
    <Card className="p-6 card-hover">
      <div className="flex items-center gap-2 mb-4">
        <BarChart className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-semibold gradient-text">即時投票結果</h2>
      </div>
      <div className="space-y-6">
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
                <span className="font-medium">{option}</span>
                <span className="font-semibold text-primary">{count} 票</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Progress 
                    value={percentage} 
                    className="h-2"
                  />
                </div>
                <span className="text-sm text-muted-foreground min-w-[4rem] text-right">
                  {percentage.toFixed(1)}%
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
      <motion.p 
        className="mt-6 text-sm text-center bg-primary/5 py-2 px-4 rounded-full"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        總投票數：<span className="font-semibold text-primary">{totalVotes}</span>
      </motion.p>
    </Card>
  );
}