import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import * as firestore from "@/lib/firestore-voting";
import { useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ReactionBar } from "@/components/reaction-bar";
import { useConfetti } from "@/hooks/use-confetti";
import { useVotingSound } from "@/hooks/use-voting-sounds";

export default function Student() {
  const { toast } = useToast();
  const params = useParams<{ id: string }>();
  const questionId = params.id;
  const [question, setQuestion] = useState<any | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const { triggerConfetti } = useConfetti();
  const { playVoteSubmitted } = useVotingSound();
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [animatedCounts, setAnimatedCounts] = useState<Record<number, number>>({});
  const [totals, setTotals] = useState<Record<number, number>>({});
  const [totalVotes, setTotalVotes] = useState(0);

  // 獲取問題數據與投票統計
  useEffect(() => {
    if (questionId) {
      // 監聽特定問題
      const unsubscribeQuestion = firestore.listenToQuestion(questionId, (q) => {
        if (q) setQuestion(q);
      });

      // 監聽投票統計（多選時 totalVoters 才是「投票人數」，stats 是「各選項被選次數」）
      const unsubscribeVotes = firestore.getVotesStats(questionId, (stats, totalVoters) => {
        setTotals(stats);
        setTotalVotes(totalVoters);
      });

      return () => {
        unsubscribeQuestion();
        unsubscribeVotes();
      };
    } else {
      // 獲取活動問題
      const unsubscribeQuestion = firestore.getActiveQuestion((q) => {
        setQuestion(q);
      });
      return () => unsubscribeQuestion();
    }
  }, [questionId]);

  // 檢查是否已經投票
  useEffect(() => {
    if (question?.id) {
      const voted = localStorage.getItem(`voted_${question.id}`);
      if (voted) {
        setHasVoted(true);
        setSelectedOption(parseInt(voted));
      } else {
        setHasVoted(false);
        setSelectedOption(null);
      }
    }
  }, [question?.id]);

  // 處理動畫計數
  useEffect(() => {
    if (hasVoted) {
      // 為每個選項創建動畫計數
      Object.entries(totals).forEach(([optionIndex, count]) => {
        const startValue = animatedCounts[Number(optionIndex)] || 0;
        const steps = 10;
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
  }, [totals, hasVoted]);

  const isExpired = firestore.isQuestionExpired(question);
  const requireIdentity: boolean = !!question?.requireIdentity;

  // 倒數時間（秒，null 表不限時）
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!question?.votingEndsAt) {
      setSecondsLeft(null);
      return;
    }
    const tick = () => {
      const ms = question.votingEndsAt.toMillis() - Date.now();
      setSecondsLeft(Math.max(0, Math.ceil(ms / 1000)));
    };
    tick();
    const t = window.setInterval(tick, 250);
    return () => window.clearInterval(t);
  }, [question?.votingEndsAt]);
  const isTimeUp = secondsLeft !== null && secondsLeft <= 0;

  // 學生身份：commited = 已按下「確認進入投票」存進 localStorage 的姓名
  // nameInput = 表單正在輸入的暫存值（按下確認前不算數）
  const [committedName, setCommittedName] = useState<string>(() => localStorage.getItem("voter_name") || "");
  const [nameInput, setNameInput] = useState<string>(() => localStorage.getItem("voter_name") || "");
  const hasIdentity = !!committedName.trim();

  const isMultiple = question?.questionType === "multiple";
  const isTrueFalse = question?.questionType === "truefalse";
  const [multiSelection, setMultiSelection] = useState<Set<number>>(new Set());
  const toggleMulti = (idx: number) => {
    setMultiSelection((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const vote = useMutation({
    mutationFn: async (selection: number | number[]) => {
      if (!question) return;
      if (isExpired) throw new Error("此題投票已結束");
      if (isTimeUp) throw new Error("倒數結束，無法投票");
      if (requireIdentity && !hasIdentity) {
        throw new Error("請先填寫姓名");
      }
      await firestore.addVote(question.id, selection, requireIdentity ? { name: committedName } : undefined);
    },
    onSuccess: (_, selection) => {
      // 🎉 慶祝動畫：confetti + 大字 overlay + 音效（多重感官回饋，學齡層越小越愛）
      triggerConfetti();
      try { playVoteSubmitted(); } catch { /* ignore audio block */ }
      setShowSuccessOverlay(true);
      window.setTimeout(() => setShowSuccessOverlay(false), 1800);

      toast({
        title: "🎉 投票成功",
        description: "感謝您的參與！",
        variant: "success",
      });
      setHasVoted(true);
      // 多選用第一個 idx 代表「已投」
      const repIdx = Array.isArray(selection) ? selection[0] : selection;
      setSelectedOption(repIdx);
      if (question?.id) {
        const stored = Array.isArray(selection) ? selection.join(",") : String(selection);
        localStorage.setItem(`voted_${question.id}`, stored);
      }
    },
    onError: (error: any) => {
      toast({
        title: "投票失敗",
        description: error.message || "請重試",
        variant: "destructive",
      });
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

  if (isExpired && !hasVoted) {
    return (
      <div className="page-container text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-2xl font-bold gradient-text">此題投票已結束</h1>
          <p className="text-muted-foreground mt-2">
            建立後 4 小時自動結束，請聯絡老師確認最新題目
          </p>
        </motion.div>
      </div>
    );
  }

  if (isTimeUp && !hasVoted) {
    return (
      <div className="page-container text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-3"
        >
          <div className="text-7xl">⏰</div>
          <h1 className="text-2xl font-bold text-amber-600">倒數結束</h1>
          <p className="text-muted-foreground">本題投票時間已到</p>
        </motion.div>
      </div>
    );
  }

  // 需具名但還沒填 → 顯示身份表單
  if (requireIdentity && !hasIdentity) {
    const submitIdentity = (e: React.FormEvent) => {
      e.preventDefault();
      const n = nameInput.trim();
      if (!n) return;
      localStorage.setItem("voter_name", n);
      setCommittedName(n);
    };

    return (
      <div className="page-container max-w-md">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-8 space-y-5">
            <div className="text-center space-y-2">
              <div className="text-5xl">📝</div>
              <h1 className="text-xl font-bold gradient-text">老師需要記錄誰投票</h1>
              <p className="text-sm text-muted-foreground">填寫一次後會自動記住，下次不用再填</p>
            </div>
            <form onSubmit={submitIdentity} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">姓名</label>
                <input
                  type="text"
                  placeholder="例：小華"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  maxLength={30}
                  autoFocus
                  className="w-full h-11 px-3 rounded-md border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-base"
                />
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={!nameInput.trim()}>
                確認進入投票
              </Button>
            </form>
          </Card>
        </motion.div>
      </div>
    );
  }

  const maxVotes = Math.max(...Object.values(totals), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-2 sm:p-4">
      {/* 投票成功 overlay：confetti 同時，畫面中央彈出綠色勾勾大圖 */}
      <AnimatePresence>
        {showSuccessOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9998] flex items-center justify-center pointer-events-none"
          >
            <motion.div
              initial={{ scale: 0.3, rotate: -15, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 1.4, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 15 }}
              className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl px-8 py-6 flex flex-col items-center gap-3 border-4 border-green-400"
            >
              <motion.div
                animate={{ rotate: [0, -10, 10, -5, 5, 0] }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-7xl"
              >
                🎉
              </motion.div>
              <div className="text-2xl font-black text-green-700">投票成功！</div>
              <div className="text-sm text-slate-500">感謝你的參與</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {secondsLeft !== null && secondsLeft > 0 && !hasVoted && (
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={`fixed top-3 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-full shadow-lg border ${
            secondsLeft <= 10
              ? "bg-red-50 border-red-300 text-red-700 animate-pulse"
              : "bg-amber-50 border-amber-300 text-amber-800"
          } font-bold flex items-center gap-2`}
        >
          ⏱ <span className="tabular-nums text-lg">{secondsLeft}</span> 秒
        </motion.div>
      )}
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
                  {question.options.map((option: string, index: number) => {
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
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isWinning ? "bg-primary text-primary-foreground" : "bg-gray-100 text-gray-600"
                              }`}>
                              <span className="text-sm font-bold">{index + 1}</span>
                            </div>
                            <span className={`text-sm sm:text-base font-medium break-words leading-tight ${isWinning ? "text-primary font-bold" : "text-gray-800"
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
                              className={`h-full rounded-full ${isWinning ? "bg-gradient-to-r from-primary to-primary/80" : "bg-primary/70"
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
                          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
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
                      {isTrueFalse ? "你的判斷？" : isMultiple ? "可複選後送出" : "請選擇您的答案"}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {isMultiple
                        ? `已選 ${multiSelection.size} 項${multiSelection.size > 0 ? "，按下方送出" : ""}`
                        : "點擊選項進行投票"}
                    </p>
                  </div>
                  <div className={isTrueFalse ? "grid grid-cols-2 gap-3 sm:gap-4" : "grid gap-3 sm:gap-4"}>
                    {question.options.map((option: string, index: number) => {
                      const isMultiSelected = isMultiple && multiSelection.has(index);
                      const isCorrectMulti = question.showAnswer && Array.isArray(question.correctAnswers) && question.correctAnswers.includes(index);
                      return (
                      <motion.div
                        key={index}
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <Button
                          onClick={() => {
                            if (hasVoted || vote.isPending) return;
                            if (isMultiple) {
                              toggleMulti(index);
                              return;
                            }
                            // 單選 / 是非題：立即送出
                            setSelectedOption(index);
                            setHasVoted(true);
                            if (questionId) {
                              localStorage.setItem(`voted_${questionId}`, index.toString());
                            }
                            vote.mutate(index);
                          }}
                          disabled={vote.isPending || hasVoted}
                          variant={(isMultiple ? isMultiSelected : selectedOption === index) ? "default" : "outline"}
                          className={
                            isTrueFalse
                              ? `w-full aspect-square h-auto text-3xl sm:text-5xl font-black transition-all duration-300 relative overflow-hidden touch-manipulation flex items-center justify-center break-keep ${
                                  selectedOption === index
                                    ? index === 0
                                      ? "bg-green-500 hover:bg-green-600 text-white scale-105 shadow-2xl"
                                      : "bg-red-500 hover:bg-red-600 text-white scale-105 shadow-2xl"
                                    : index === 0
                                      ? "border-4 border-green-300 text-green-700 hover:bg-green-50 hover:border-green-500 hover:scale-105"
                                      : "border-4 border-red-300 text-red-700 hover:bg-red-50 hover:border-red-500 hover:scale-105"
                                }`
                              : `w-full h-14 sm:h-12 text-base sm:text-lg font-medium transition-all duration-300 relative overflow-hidden touch-manipulation ${
                                  (isMultiple ? isMultiSelected : selectedOption === index)
                                    ? "bg-primary text-primary-foreground transform hover:scale-[1.02] hover:shadow-lg shadow-md"
                                    : "hover:bg-primary/10 hover:border-primary/50 active:bg-primary/5"
                                }`
                          }
                          asChild
                        >
                          <motion.div
                            whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <div className="relative z-10 flex items-center justify-center gap-2">
                              {isMultiple && (
                                <span className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${
                                  isMultiSelected ? "bg-white border-white" : "border-current opacity-60"
                                }`}>
                                  {isMultiSelected && <CheckCircle2 className="w-4 h-4 text-primary" />}
                                </span>
                              )}
                              <span>{option}</span>
                              {question.showAnswer && (question.correctAnswer === index || isCorrectMulti) && (
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
                                animate={{ x: ["0%", "100%"] }}
                                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                style={{ opacity: (isMultiple ? isMultiSelected : selectedOption === index) ? 0 : 1 }}
                              />
                            </div>
                          </motion.div>
                        </Button>
                      </motion.div>
                      );
                    })}
                  </div>

                  {/* 多選送出按鈕 */}
                  {isMultiple && !hasVoted && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-6"
                    >
                      <Button
                        size="lg"
                        className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-primary to-purple-600 hover:scale-[1.02] transition-transform shadow-lg"
                        disabled={vote.isPending || multiSelection.size === 0}
                        onClick={() => {
                          if (vote.isPending || multiSelection.size === 0) return;
                          const arr = Array.from(multiSelection).sort((a, b) => a - b);
                          setHasVoted(true);
                          if (questionId) {
                            localStorage.setItem(`voted_${questionId}`, arr.join(","));
                          }
                          vote.mutate(arr);
                        }}
                      >
                        {vote.isPending ? "送出中…" : `✅ 送出我的 ${multiSelection.size} 個選擇`}
                      </Button>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Card>
      </div>
      {questionId && <ReactionBar questionId={questionId} />}
    </div>
  );
}