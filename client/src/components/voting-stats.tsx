import { useQuery } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import type { Question, Vote } from "@shared/schema";
import { motion, useAnimation, AnimatePresence } from "framer-motion";
import { BarChart } from "lucide-react";
import { useEffect, useState } from "react";

interface VotingStatsProps {
  question: Question;
}

export function VotingStats({ question }: VotingStatsProps) {
  const { data: votes = [] } = useQuery<Vote[]>({
    queryKey: [`/api/questions/${question.id}/votes`],
    refetchInterval: 1000,
  });

  const [animatedPercentages, setAnimatedPercentages] = useState<Record<number, number>>({});
  const controls = useAnimation();

  const totals = votes.reduce((acc, vote) => {
    acc[vote.optionIndex] = (acc[vote.optionIndex] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  const totalVotes = votes.length;

  // Animate percentages when votes change
  useEffect(() => {
    question.options.forEach((_, index) => {
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

  // Start animation when component mounts
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
          {question.options.map((option, index) => {
            const count = totals[index] || 0;
            const percentage = animatedPercentages[index] || 0;

            return (
              <motion.div
                key={index}
                variants={itemVariants}
                layout
                className="space-y-2"
              >
                <div className="flex justify-between items-center mb-1">
                  <motion.span 
                    className="font-medium"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    {option}
                  </motion.span>
                  <motion.span 
                    className="font-semibold text-primary"
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
                    >
                      <Progress 
                        value={percentage} 
                        className="h-2"
                      />
                    </motion.div>
                  </div>
                  <motion.span 
                    className="text-sm text-muted-foreground min-w-[4rem] text-right"
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