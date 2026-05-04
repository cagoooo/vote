import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScreenshotUpload } from "@/components/screenshot-upload";
import { QRDisplay } from "@/components/qr-display";
import { VotingStats } from "@/components/voting-stats";
import { ShareButton } from "@/components/share-button";
import { useToast } from "@/hooks/use-toast";
import { useVotingSound } from "@/hooks/use-voting-sounds";
import * as firestore from "@/lib/firestore-voting";
import { auth, signInWithGoogle, signOut } from "@/lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import { Plus, Minus, Sparkles, RefreshCw, CheckCircle2, Eye, EyeOff, LogIn, LogOut, UserCircle, LayoutGrid, Download, Monitor, Timer, UserCheck, X as XIcon } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { exportQuestionVotes } from "@/lib/csv-export";
import { compressImageToFit } from "@/lib/image-compress";
import { uploadImageIfLarge } from "@/lib/image-storage";

export default function Teacher() {
  const [imageUrl, setImageUrl] = useState("");
  const [options, setOptions] = useState<string[]>(["", "", ""]);
  const [requireIdentity, setRequireIdentity] = useState(false);
  const [createdQuestion, setCreatedQuestion] = useState<any | null>(null);
  const [globalActiveQuestion, setGlobalActiveQuestion] = useState<any | null>(null);
  const [votesStats, setVotesStats] = useState<Record<number, number>>({});
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const { toast } = useToast();
  const { playVoteSessionStart, playVoteSubmitted } = useVotingSound();

  useEffect(() => onAuthStateChanged(auth, setCurrentUser), []);

  // 從 dashboard「查看」按鈕進來時，URL 會帶 ?q=<id>，自動載入該題
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qid = params.get("q");
    if (!qid) return;
    firestore.getQuestion(qid).then((q) => {
      if (q) setCreatedQuestion(q);
    });
    // 載入後把 query string 從網址抹掉，避免重新整理重複載入
    const url = new URL(window.location.href);
    url.searchParams.delete("q");
    window.history.replaceState({}, "", url.toString());
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      const user = await signInWithGoogle();
      const name = user.displayName?.split(" ")[0] ?? user.email?.split("@")[0] ?? "老師";
      toast({
        title: `👋 歡迎回來，${name}！`,
        description: "你的題目從此跨裝置同步，換電腦也找得到。",
        variant: "success",
      });
    } catch (err: any) {
      if (err?.code === "auth/popup-closed-by-user") return;
      if (err?.code === "auth/cancelled-popup-request") return;
      toast({
        title: "登入失敗",
        description: err?.message ?? "請稍後再試",
        variant: "destructive",
      });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "已登出",
      description: "下次回來請再次用 Google 登入以找回你的題目",
    });
  };

  // 監聽背景活動問題 (用於顯示提示)
  useEffect(() => {
    const unsubscribe = firestore.getActiveQuestion((question) => {
      setGlobalActiveQuestion(question);
    });
    return () => unsubscribe();
  }, []);

  // 監聽目前管理的特定問題 (確保 correctAnswer/showAnswer 同步)
  useEffect(() => {
    if (createdQuestion?.id) {
      const unsubscribe = firestore.listenToQuestion(createdQuestion.id, (question) => {
        if (question) {
          setCreatedQuestion(question);
        }
      });
      return () => unsubscribe();
    }
  }, [createdQuestion?.id]);

  // 監聽投票統計
  useEffect(() => {
    if (createdQuestion?.id) {
      const unsubscribe = firestore.getVotesStats(createdQuestion.id, (stats) => {
        // 檢查是否有新投票（總數增加）
        const oldTotal = Object.values(votesStats).reduce((a, b) => a + b, 0);
        const newTotal = Object.values(stats).reduce((a, b) => a + b, 0);
        if (newTotal > oldTotal) {
          playVoteSubmitted();
        }
        setVotesStats(stats);
      });
      return () => unsubscribe();
    }
  }, [createdQuestion?.id, votesStats, playVoteSubmitted]);

  const createQuestion = useMutation({
    mutationFn: async () => {
      const filteredOptions = options.filter(Boolean);
      return await firestore.createQuestion(imageUrl, filteredOptions, { requireIdentity });
    },
    onSuccess: (question) => {
      setCreatedQuestion(question);
      playVoteSessionStart();
      toast({
        title: "成功建立問題",
        description: "學生現在可以開始投票了",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "建立問題失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const setCorrectAnswer = useMutation({
    mutationFn: async (correctAnswer: number) => {
      if (!createdQuestion) throw new Error("No question created");
      await firestore.setCorrectAnswer(createdQuestion.id, correctAnswer);
    },
    onSuccess: (_, correctAnswer) => {
      toast({
        title: "正確答案已設定",
        description: `選項 ${correctAnswer + 1} 已設為正確答案`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "設定失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleShowAnswer = useMutation({
    mutationFn: async (show: boolean) => {
      if (!createdQuestion) throw new Error("No question created");
      await firestore.toggleShowAnswer(createdQuestion.id, show);
    },
    onSuccess: (_, show) => {
      toast({
        title: show ? "正確答案已顯示" : "正確答案已隱藏",
        description: show
          ? "學生現在可以看到正確答案"
          : "正確答案已從投票結果中隱藏",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "操作失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetVotes = useMutation({
    mutationFn: async () => {
      if (!createdQuestion) throw new Error("No question created");
      await firestore.resetVotes(createdQuestion.id);
    },
    onSuccess: () => {
      setVotesStats({});
      toast({
        title: "投票已重置",
        description: "所有投票記錄已清除",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "重置失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetAll = async () => {
    if (createdQuestion?.id) {
      await firestore.deactivateQuestion(createdQuestion.id);
    }
    setImageUrl("");
    setOptions(["", "", ""]);
    setCreatedQuestion(null);
    setVotesStats({});
    toast({
      title: "已重置所有設定",
      description: "您可以重新開始建立新的投票",
    });
  };

  const addOption = () => setOptions([...options, ""]);
  const removeOption = (index: number) => {
    const newOptions = [...options];
    newOptions.splice(index, 1);
    setOptions(newOptions);
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validOptions = options.filter(Boolean);

    if (!imageUrl) {
      toast({
        title: "缺少圖片",
        description: "請先上傳或截取圖片",
        variant: "destructive",
      });
      return;
    }

    if (validOptions.length < 2) {
      toast({
        title: "選項不足",
        description: "請至少填寫兩個選項",
        variant: "destructive",
      });
      return;
    }

    await createQuestion.mutateAsync();
  };

  const handleImageSelect = async (image: string) => {
    try {
      // 1) 先壓縮到 700KB 內（保險，避免 Storage 上傳超大檔）
      const compressed = await compressImageToFit(image);
      if (compressed.didCompress) {
        const beforeKB = (compressed.originalBytes / 1024).toFixed(0);
        const afterKB = (compressed.finalBytes / 1024).toFixed(0);
        toast({
          title: "圖片已自動壓縮",
          description: `${beforeKB} KB → ${afterKB} KB`,
          variant: "success",
        });
      }
      // 2) 大圖丟 Storage（< 50KB 保留 inline 省 RTT）
      const finalUrl = await uploadImageIfLarge(compressed.dataUrl);
      setImageUrl(finalUrl);
    } catch (err: any) {
      toast({
        title: "圖片處理失敗",
        description: err?.message ?? "請再試一次",
        variant: "destructive",
      });
    }
  };

  const validOptionCount = options.filter(Boolean).length;
  const canSubmit = imageUrl && validOptionCount >= 2;

  return (
    <div className="page-container max-w-4xl">
      <div className="flex items-center justify-center gap-2 sm:gap-3 md:gap-4 mb-6 md:mb-8 transition-all duration-300">
        <a href="https://www.smes.tyc.edu.tw/" target="_blank" rel="noopener noreferrer"
          className="relative group p-2 rounded-lg transition-all duration-300 hover:bg-yellow-100/10">
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/20 to-amber-500/20 rounded-lg blur opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
          <img
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt="Logo"
            className="h-10 sm:h-12 md:h-16 lg:h-20 w-auto object-contain relative transition-all duration-300 
              group-hover:scale-110 group-hover:rotate-3 group-hover:brightness-110 
              group-hover:shadow-[0_0_30px_rgba(251,191,36,0.3)] 
              group-active:scale-95 group-active:rotate-0"
          />
        </a>
        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold gradient-text transition-all duration-300">
          即時投票系統
        </h1>
      </div>

      <div className="flex items-center justify-end gap-2 mb-4">
        {currentUser && !currentUser.isAnonymous ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2"
          >
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-50 to-green-50 border border-green-200 shadow-sm"
              title={currentUser.email ?? ""}
            >
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-full ring-2 ring-white"
                />
              ) : (
                <UserCircle className="w-6 h-6 text-green-600" />
              )}
              <div className="flex flex-col leading-tight pr-1">
                <span className="text-sm font-semibold text-gray-800 max-w-[180px] truncate">
                  {currentUser.displayName ?? currentUser.email?.split("@")[0] ?? "已登入"}
                </span>
                <span className="text-[10px] text-green-700 font-medium">已登入 · 跨裝置同步</span>
              </div>
            </div>
            <Link href="/dashboard">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                <LayoutGrid className="w-4 h-4" />我的題目
              </Button>
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="h-9 px-2 text-gray-500 hover:text-red-600 hover:bg-red-50"
              title="登出"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </motion.div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">
              匿名模式（換瀏覽器將找不到舊題）
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGoogleSignIn}
              className="h-8 px-3 border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              <LogIn className="w-3.5 h-3.5 mr-1.5" />Google 登入
            </Button>
          </div>
        )}
      </div>

      {!createdQuestion ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          {globalActiveQuestion && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex items-center justify-between gap-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-full">
                  <Eye className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-800">目前有一個進行中的投票</p>
                  <p className="text-xs text-blue-600">您可以繼續管理它，或直接建立新問題（舊問題將自動停用）</p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreatedQuestion(globalActiveQuestion)}
                className="bg-white hover:bg-blue-100 border-blue-200 text-blue-700 whitespace-nowrap"
              >
                查看目前結果
              </Button>
            </motion.div>
          )}
          <ScreenshotUpload onImageSelect={handleImageSelect} />

          <Card className="p-6 card-hover">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              選項設置
            </h2>
            <div className="space-y-4 animate-fade-in">
              {options.map((option, index) => (
                <div key={index} className="flex gap-2 animate-slide-up" style={{ animationDelay: `${index * 100}ms` }}>
                  <Input
                    value={option}
                    onChange={(e) => updateOption(index, e.target.value)}
                    placeholder={`選項 ${index + 1}`}
                    className="transition-all duration-300 focus:ring-2 focus:ring-green-500/20 border-green-100 hover:border-green-200 focus:border-green-300 focus:outline-none bg-green-50/30"
                  />
                  {options.length > 2 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeOption(index)}
                      className="hover:bg-red-500/10 hover:border-red-200 transition-colors"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={addOption}
                className="flex items-center gap-2 hover:bg-green-500/10 hover:border-green-200 transition-colors"
              >
                <Plus className="h-4 w-4" />
                添加選項
              </Button>
            </div>

            <label className="mt-5 flex items-start gap-3 p-3 rounded-lg border border-dashed border-blue-200 bg-blue-50/40 hover:bg-blue-50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={requireIdentity}
                onChange={(e) => setRequireIdentity(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-blue-600"
              />
              <div className="flex-1">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-blue-900">
                  <UserCheck className="w-4 h-4" />需要學生具名才能投票
                </div>
                <div className="text-xs text-blue-700/80 mt-0.5">
                  學生第一次投票要填姓名+座號（會記住下次自動帶入）。適合形成性評量、補救教學追蹤
                </div>
              </div>
            </label>
          </Card>

          <Button
            type="submit"
            className="w-full h-12 text-lg shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-r from-primary via-red-500 to-purple-600 hover:scale-[1.02] ripple"
            disabled={createQuestion.isPending || !canSubmit}
          >
            {createQuestion.isPending ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                建立中...
              </div>
            ) : (
              "建立問題"
            )}
          </Button>

          {!imageUrl && (
            <p className="text-sm text-muted-foreground text-center animate-fade-in">
              請先上傳或截取圖片
            </p>
          )}
          {validOptionCount < 2 && (
            <p className="text-sm text-muted-foreground text-center animate-fade-in">
              請至少填寫兩個選項（目前已填寫 {validOptionCount} 個）
            </p>
          )}
        </form>
      ) : (
        <div className="space-y-6 animate-fade-in">
          <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
            <h2 className="text-xl font-semibold gradient-text">投票進行中</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <Link href={`/present/${createdQuestion.id}`}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-purple-200 text-purple-700 hover:bg-purple-50"
                  title="開啟全螢幕投影模式"
                >
                  <Monitor className="w-4 h-4" />課堂模式
                </Button>
              </Link>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => exportQuestionVotes(createdQuestion).catch((err) => toast({ title: "匯出失敗", description: err.message, variant: "destructive" }))}
                className="gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              >
                <Download className="w-4 h-4" />匯出 CSV
              </Button>
              <ShareButton
                url={window.location.href}
                question={createdQuestion}
                votes={[]}
              />
            </div>
          </div>

          <Card className="p-6 card-hover">
            <div className="flex justify-center mb-6">
              <img
                src={createdQuestion.imageUrl}
                alt="問題圖片"
                className="max-w-full max-h-[40vh] w-auto h-auto object-contain rounded-lg shadow-lg"
              />
            </div>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <QRDisplay questionId={createdQuestion.id} roomCode={createdQuestion.roomCode} />
            <VotingStats question={createdQuestion} />
          </div>

          {/* 倒數計時控制 */}
          <Card className="p-4 sm:p-6 bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-1.5 bg-amber-100 rounded-full">
                <Timer className="w-4 h-4 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm sm:text-base font-bold text-gray-800">倒數計時投票</h3>
                <p className="text-xs text-gray-600">
                  {createdQuestion.votingEndsAt
                    ? "倒數中…結束後學生自動無法投票"
                    : "限時投票更刺激！按下後學生端會看到倒數"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {[30, 60, 90].map((sec) => (
                <Button
                  key={sec}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => firestore.startCountdown(createdQuestion.id, sec).catch((err) => toast({ title: "啟動失敗", description: err.message, variant: "destructive" }))}
                  disabled={!!createdQuestion.votingEndsAt}
                  className="border-amber-300 text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                >
                  ⏱ {sec} 秒
                </Button>
              ))}
              {createdQuestion.votingEndsAt && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => firestore.cancelCountdown(createdQuestion.id).catch((err) => toast({ title: "取消失敗", description: err.message, variant: "destructive" }))}
                  className="text-red-600 hover:bg-red-50 ml-auto"
                >
                  <XIcon className="w-3.5 h-3.5 mr-1" />取消倒數
                </Button>
              )}
            </div>
          </Card>

          {/* Correct Answer Management */}
          <Card className="p-4 sm:p-6 card-hover shadow-lg border-0 bg-gradient-to-r from-green-50 to-blue-50">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-green-100 rounded-full">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-800">
                正確答案管理
              </h3>
            </div>

            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-medium text-gray-700">
                    設定正確答案選項：
                  </p>
                  {createdQuestion.correctAnswer !== null && (
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                      已設定
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {createdQuestion.options.map((option: string, index: number) => (
                    <Button
                      key={index}
                      variant={createdQuestion.correctAnswer === index ? "default" : "outline"}
                      size="default"
                      onClick={() => setCorrectAnswer.mutate(index)}
                      disabled={setCorrectAnswer.isPending}
                      className={`h-auto min-h-[3rem] p-3 text-left text-sm font-medium transition-all duration-200 ${createdQuestion.correctAnswer === index
                        ? "bg-green-500 hover:bg-green-600 text-white shadow-lg transform hover:scale-105"
                        : "hover:bg-green-50 hover:border-green-300 hover:shadow-md active:scale-95"
                        }`}
                    >
                      <div className="w-full">
                        <div className="font-bold text-xs mb-1">選項 {index + 1}</div>
                        <div className="text-xs leading-tight break-words">
                          {option.length > 30 ? `${option.substring(0, 30)}...` : option}
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-semibold text-gray-800">
                        答案顯示狀態
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${createdQuestion.showAnswer
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600"
                        }`}>
                        {createdQuestion.showAnswer ? "已公開" : "已隱藏"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      {createdQuestion.showAnswer
                        ? "學生現在可以在投票結果中看到正確答案標記"
                        : "正確答案僅對老師可見，學生無法看到"}
                    </p>
                  </div>
                  <Button
                    onClick={() => toggleShowAnswer.mutate(!createdQuestion.showAnswer)}
                    disabled={toggleShowAnswer.isPending || createdQuestion.correctAnswer === null}
                    variant={createdQuestion.showAnswer ? "destructive" : "default"}
                    size="default"
                    className={`flex items-center gap-2 min-w-[120px] h-10 font-medium transition-all duration-200 ${createdQuestion.showAnswer
                      ? "hover:shadow-lg"
                      : "bg-blue-500 hover:bg-blue-600 hover:shadow-lg"
                      }`}
                  >
                    {createdQuestion.showAnswer ? (
                      <>
                        <EyeOff className="w-4 h-4" />
                        隱藏答案
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4" />
                        顯示答案
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {createdQuestion.correctAnswer !== null && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-300 rounded-lg p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="p-1 bg-green-100 rounded-full flex-shrink-0 mt-0.5">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-green-800 mb-1">
                        目前正確答案
                      </h4>
                      <div className="bg-white rounded-md p-3 border border-green-200">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded">
                            選項 {createdQuestion.correctAnswer + 1}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed break-words">
                          {createdQuestion.options[createdQuestion.correctAnswer]}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Additional Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Button
              onClick={() => resetVotes.mutate()}
              disabled={resetVotes.isPending}
              variant="outline"
              className="flex items-center justify-center gap-2 h-12 sm:h-14 font-medium transition-all duration-200 hover:bg-orange-50 hover:border-orange-300 text-orange-600 hover:shadow-md active:scale-95 border-2"
            >
              <RefreshCw className={`w-5 h-5 ${resetVotes.isPending ? 'animate-spin' : ''}`} />
              <span className="text-sm sm:text-base">重置投票</span>
            </Button>
            <Button
              onClick={resetAll}
              className="flex items-center justify-center gap-2 h-12 sm:h-14 font-medium transition-all duration-200 bg-red-50 hover:bg-red-100 text-red-600 hover:shadow-md active:scale-95 border-2 border-red-200 hover:border-red-300"
              variant="ghost"
            >
              <RefreshCw className="w-5 h-5" />
              <span className="text-sm sm:text-base">重新建立投票</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}