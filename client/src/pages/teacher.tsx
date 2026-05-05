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
import { Plus, Minus, Sparkles, RefreshCw, CheckCircle2, Eye, EyeOff, LogIn, LogOut, UserCircle, LayoutGrid, Download, Monitor, Timer, UserCheck, X as XIcon, CheckSquare, Circle, Pencil, GripVertical, ChevronLeft, ChevronRight, Wand2, Rocket } from "lucide-react";
import { EditQuestionDialog } from "@/components/edit-question-dialog";
import { WordCloud } from "@/components/word-cloud";
import { motion, Reorder } from "framer-motion";
import { Link } from "wouter";
import { exportQuestionVotes } from "@/lib/csv-export";
import { compressImageToFit } from "@/lib/image-compress";
import { uploadImageIfLarge } from "@/lib/image-storage";

export default function Teacher() {
  const [imageUrl, setImageUrl] = useState("");
  // 選項用 { id, value } 而非純 string，給 framer-motion Reorder 穩定 key 用
  type OptionItem = { id: string; value: string };
  const newOptionId = () => `opt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const [options, setOptions] = useState<OptionItem[]>(() => [
    { id: newOptionId(), value: "" },
    { id: newOptionId(), value: "" },
    { id: newOptionId(), value: "" },
  ]);
  const [questionType, setQuestionType] = useState<"single" | "multiple" | "truefalse" | "shortanswer">("single");
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // 建題介面模式：quick（單頁，預設）/ wizard（新手分步驟）
  const [formMode, setFormMode] = useState<"wizard" | "quick">(
    () => (localStorage.getItem("teacher_form_mode") as any) || "quick"
  );
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const switchFormMode = (m: "wizard" | "quick") => {
    setFormMode(m);
    localStorage.setItem("teacher_form_mode", m);
    if (m === "wizard") setWizardStep(1);
  };
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
      const unsubscribe = firestore.getVotesStats(createdQuestion.id, (stats, totalVoters) => {
        // 用「投票人數」變化偵測新票（多選一張票會貢獻多個 stat 值，不能用 sum）
        const prev = (firestore as any)._lastTotalVoters_ ?? 0;
        if (totalVoters > prev) {
          playVoteSubmitted();
        }
        (firestore as any)._lastTotalVoters_ = totalVoters;
        setVotesStats(stats);
      });
      return () => unsubscribe();
    }
  }, [createdQuestion?.id, votesStats, playVoteSubmitted]);

  const createQuestion = useMutation({
    mutationFn: async () => {
      // 是非題、簡答題自動鎖定 options，老師不用填
      const finalOptions =
        questionType === "truefalse"
          ? firestore.TRUEFALSE_OPTIONS
          : questionType === "shortanswer"
            ? firestore.SHORTANSWER_PLACEHOLDER_OPTIONS
            : options.map((o) => o.value).filter(Boolean);
      return await firestore.createQuestion(imageUrl, finalOptions, { requireIdentity, questionType });
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

  // 多選題：toggle 某選項加入/移出正解集合
  const toggleMultiCorrect = useMutation({
    mutationFn: async (index: number) => {
      if (!createdQuestion) throw new Error("No question created");
      const current: number[] = Array.isArray(createdQuestion.correctAnswers)
        ? createdQuestion.correctAnswers
        : [];
      const next = current.includes(index)
        ? current.filter((i) => i !== index)
        : [...current, index];
      await firestore.setCorrectAnswers(createdQuestion.id, next);
    },
    onError: (err: Error) => toast({ title: "設定失敗", description: err.message, variant: "destructive" }),
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
    setOptions([
      { id: newOptionId(), value: "" },
      { id: newOptionId(), value: "" },
      { id: newOptionId(), value: "" },
    ]);
    setCreatedQuestion(null);
    setWizardStep(1);
    setVotesStats({});
    toast({
      title: "已重置所有設定",
      description: "您可以重新開始建立新的投票",
    });
  };

  const addOption = () => setOptions([...options, { id: newOptionId(), value: "" }]);
  const removeOptionById = (id: string) => {
    setOptions(options.filter((o) => o.id !== id));
  };
  const updateOptionById = (id: string, value: string) => {
    setOptions(options.map((o) => (o.id === id ? { ...o, value } : o)));
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

  const validOptionCount = options.filter((o) => o.value.trim()).length;
  const optionsRequired = questionType === "single" || questionType === "multiple";
  const canSubmit = !!imageUrl && (!optionsRequired || validOptionCount >= 2);

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
          {/* 模式切換 bar */}
          <div className="flex items-center justify-between gap-2 text-xs flex-wrap">
            <div className="text-slate-500">
              {formMode === "wizard" ? "💡 新手引導模式：分 3 步建題" : "⚡ 快速模式：所有設定一次填完"}
            </div>
            <div className="flex items-center gap-1 bg-slate-100 rounded-full p-0.5">
              <button
                type="button"
                onClick={() => switchFormMode("wizard")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  formMode === "wizard" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"
                }`}
              >
                <Wand2 className="w-3 h-3 inline mr-1" />引導
              </button>
              <button
                type="button"
                onClick={() => switchFormMode("quick")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  formMode === "quick" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"
                }`}
              >
                <Rocket className="w-3 h-3 inline mr-1" />快速
              </button>
            </div>
          </div>

          {/* Wizard 進度條 */}
          {formMode === "wizard" && (
            <div className="flex items-center gap-2">
              {[1, 2, 3].map((s, i) => (
                <div key={s} className="flex items-center gap-2 flex-1">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                    wizardStep > s ? "bg-green-500 text-white" :
                    wizardStep === s ? "bg-blue-600 text-white scale-110 shadow-md" :
                    "bg-slate-200 text-slate-400"
                  }`}>
                    {wizardStep > s ? <CheckCircle2 className="w-4 h-4" /> : s}
                  </div>
                  <div className="text-xs flex-1 hidden sm:block">
                    <div className={wizardStep === s ? "font-semibold text-blue-700" : "text-slate-500"}>
                      {s === 1 ? "選題型 + 上傳圖片" : s === 2 ? "設定選項" : "確認後建立"}
                    </div>
                  </div>
                  {i < 2 && <div className={`hidden sm:block flex-1 h-0.5 transition-colors ${wizardStep > s ? "bg-green-400" : "bg-slate-200"}`} />}
                </div>
              ))}
            </div>
          )}

          {(formMode === "quick" || wizardStep === 1) && (
          <>
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

          {/* wizard step 1 也要先讓老師選題型，這樣 step 2 才知道要不要顯示選項 */}
          {formMode === "wizard" && (
            <Card className="p-4 sm:p-6">
              <p className="text-sm font-semibold text-slate-700 mb-3">選擇題型</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1 bg-slate-100 rounded-lg">
                <button type="button" onClick={() => setQuestionType("single")} className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-sm font-medium transition-all ${questionType === "single" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}>
                  <Circle className="w-4 h-4" />單選
                </button>
                <button type="button" onClick={() => setQuestionType("multiple")} className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-sm font-medium transition-all ${questionType === "multiple" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}>
                  <CheckSquare className="w-4 h-4" />多選
                </button>
                <button type="button" onClick={() => setQuestionType("truefalse")} className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-sm font-medium transition-all ${questionType === "truefalse" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}>
                  ⚡是非
                </button>
                <button type="button" onClick={() => setQuestionType("shortanswer")} className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-sm font-medium transition-all ${questionType === "shortanswer" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}>
                  💬簡答
                </button>
              </div>

              {/* 各題型說明卡 — 點選後立即視覺回饋 */}
              <motion.div
                key={questionType}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="mt-4"
              >
                {questionType === "single" && (
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-sky-50 border border-blue-200 rounded-lg space-y-2">
                    <p className="text-sm font-semibold text-blue-900 flex items-center gap-1.5">
                      <Circle className="w-4 h-4" />單選題
                    </p>
                    <ul className="text-xs text-blue-800/90 space-y-1 list-disc list-inside">
                      <li>下一步可填 2 個以上選項，學生只能選一個</li>
                      <li>適合：常識問答、閱讀測驗、多選一</li>
                      <li>學生點選即送出，不能改</li>
                    </ul>
                  </div>
                )}
                {questionType === "multiple" && (
                  <div className="p-4 bg-gradient-to-r from-purple-50 to-fuchsia-50 border border-purple-200 rounded-lg space-y-2">
                    <p className="text-sm font-semibold text-purple-900 flex items-center gap-1.5">
                      <CheckSquare className="w-4 h-4" />多選題
                    </p>
                    <ul className="text-xs text-purple-800/90 space-y-1 list-disc list-inside">
                      <li>下一步可填 2 個以上選項，學生可勾多個再送出</li>
                      <li>適合：哪些原因 / 列出所有正確答案</li>
                      <li>正解可設多個，全選對才算對</li>
                    </ul>
                  </div>
                )}
                {questionType === "truefalse" && (
                  <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg space-y-2">
                    <p className="text-sm font-semibold text-amber-900">⚡ 是非題（自動使用以下兩個選項）</p>
                    <p className="text-xs text-amber-800/90">不用填選項，下一步直接到具名設定。學生看到的是：</p>
                    <div className="flex gap-3">
                      <div className="flex-1 bg-white rounded-md py-3 text-center font-bold text-2xl border-2 border-green-300">⭕ 是</div>
                      <div className="flex-1 bg-white rounded-md py-3 text-center font-bold text-2xl border-2 border-red-300">❌ 否</div>
                    </div>
                  </div>
                )}
                {questionType === "shortanswer" && (
                  <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg space-y-2">
                    <p className="text-sm font-semibold text-purple-900">💬 簡答題</p>
                    <ul className="text-xs text-purple-800/90 space-y-1 list-disc list-inside">
                      <li>不用填選項，學生會看到文字輸入框（最多 {firestore.SHORTANSWER_MAX_LENGTH} 字）</li>
                      <li>老師端與課堂模式即時顯示 <strong>文字雲</strong>，相同答案合併、出現越多字級越大</li>
                      <li>適合：腦力激盪、收集回饋、單字接龍</li>
                    </ul>
                  </div>
                )}
              </motion.div>
            </Card>
          )}
          </>
          )}

          {(formMode === "quick" || wizardStep === 2) && (
          <Card className="p-6 card-hover">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              選項設置
            </h2>

            {/* 題型切換（4 種）— wizard 模式 step 1 已選過，不再顯示避免視覺重複 */}
            {formMode === "quick" && (
            <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setQuestionType("single")}
                className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-sm font-medium transition-all ${
                  questionType === "single" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Circle className="w-4 h-4" />單選
              </button>
              <button
                type="button"
                onClick={() => setQuestionType("multiple")}
                className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-sm font-medium transition-all ${
                  questionType === "multiple" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <CheckSquare className="w-4 h-4" />多選
              </button>
              <button
                type="button"
                onClick={() => setQuestionType("truefalse")}
                className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-sm font-medium transition-all ${
                  questionType === "truefalse" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                ⚡是非
              </button>
              <button
                type="button"
                onClick={() => setQuestionType("shortanswer")}
                className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-sm font-medium transition-all ${
                  questionType === "shortanswer" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                💬簡答
              </button>
            </div>
            )}

            {questionType === "truefalse" && (
              <div className="mb-4 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-900 font-medium mb-2">是非題會自動使用兩個選項：</p>
                <div className="flex gap-3">
                  <div className="flex-1 bg-white rounded-md py-3 text-center font-bold text-2xl border-2 border-green-300">
                    ⭕ 是
                  </div>
                  <div className="flex-1 bg-white rounded-md py-3 text-center font-bold text-2xl border-2 border-red-300">
                    ❌ 否
                  </div>
                </div>
              </div>
            )}

            {questionType === "shortanswer" && (
              <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg">
                <p className="text-sm text-purple-900 font-medium mb-2">💬 簡答題：學生會看到文字輸入框</p>
                <ul className="text-xs text-purple-800/90 space-y-1 list-disc list-inside">
                  <li>每位學生最多輸入 {firestore.SHORTANSWER_MAX_LENGTH} 字</li>
                  <li>老師端與課堂模式即時顯示 <strong>文字雲</strong>，相同答案合併、出現越多字級越大</li>
                  <li>適合：腦力激盪、收集回饋、單字接龍</li>
                </ul>
              </div>
            )}

            <div className={questionType === "truefalse" || questionType === "shortanswer" ? "opacity-40 pointer-events-none" : ""}>
              {options.length >= 3 && (
                <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                  <GripVertical className="w-3 h-3" />可拖曳左側把手調整順序
                </p>
              )}
              <Reorder.Group
                axis="y"
                values={options}
                onReorder={setOptions}
                className="space-y-3"
              >
                {options.map((opt, index) => (
                  <Reorder.Item
                    key={opt.id}
                    value={opt}
                    className="flex items-center gap-2 bg-white rounded-md cursor-default"
                    whileDrag={{ scale: 1.02, boxShadow: "0 8px 24px rgba(59,130,246,0.25)", zIndex: 10 }}
                  >
                    <button
                      type="button"
                      className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0 p-1"
                      aria-label="拖曳排序"
                      onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
                    >
                      <GripVertical className="w-4 h-4" />
                    </button>
                    <Input
                      value={opt.value}
                      onChange={(e) => updateOptionById(opt.id, e.target.value)}
                      placeholder={`選項 ${index + 1}`}
                      className="transition-all duration-300 focus:ring-2 focus:ring-green-500/20 border-green-100 hover:border-green-200 focus:border-green-300 focus:outline-none bg-green-50/30"
                    />
                    {options.length > 2 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => removeOptionById(opt.id)}
                        className="hover:bg-red-500/10 hover:border-red-200 transition-colors flex-shrink-0"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    )}
                  </Reorder.Item>
                ))}
              </Reorder.Group>
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
          )}

          {/* wizard step 3：摘要預覽 */}
          {formMode === "wizard" && wizardStep === 3 && (
            <Card className="p-6 bg-gradient-to-br from-emerald-50 to-blue-50 border-emerald-200">
              <h3 className="text-lg font-bold text-emerald-900 mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />準備建立 — 確認以下設定
              </h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-xs text-slate-500">題目圖片</div>
                  {imageUrl ? (
                    <img src={imageUrl} alt="題目" className="w-full max-h-40 object-contain bg-white rounded border" />
                  ) : (
                    <div className="text-sm text-red-600">⚠️ 還沒上傳圖片，請回 step 1</div>
                  )}
                </div>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-slate-500">題型：</span>
                    <span className="font-semibold text-slate-800 ml-1">
                      {questionType === "single" ? "◯ 單選題" : questionType === "multiple" ? "☑️ 多選題" : questionType === "truefalse" ? "⚡ 是非題" : "💬 簡答題"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">具名：</span>
                    <span className="font-semibold ml-1">{requireIdentity ? "✅ 需要學生填姓名" : "❌ 匿名投票"}</span>
                  </div>
                  {questionType === "single" || questionType === "multiple" ? (
                    <div>
                      <span className="text-slate-500">選項（{validOptionCount} 個）：</span>
                      <ol className="list-decimal list-inside mt-1 space-y-0.5 text-slate-700">
                        {options.filter((o) => o.value.trim()).map((o, i) => (
                          <li key={o.id}>{o.value}</li>
                        ))}
                      </ol>
                    </div>
                  ) : (
                    <div className="text-slate-600 text-xs">{questionType === "truefalse" ? "選項自動鎖定 ⭕ 是 / ❌ 否" : `學生可輸入最多 ${firestore.SHORTANSWER_MAX_LENGTH} 字`}</div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* wizard 模式的 Prev/Next + 建立按鈕 */}
          {formMode === "wizard" ? (
            <div className="flex items-center gap-2">
              {wizardStep > 1 ? (
                <Button type="button" variant="outline" onClick={() => setWizardStep((wizardStep - 1) as 1 | 2 | 3)} className="gap-1">
                  <ChevronLeft className="w-4 h-4" />上一步
                </Button>
              ) : <div className="flex-1" />}
              <div className="flex-1" />
              {wizardStep < 3 ? (
                <Button
                  type="button"
                  onClick={() => setWizardStep((wizardStep + 1) as 1 | 2 | 3)}
                  disabled={
                    (wizardStep === 1 && !imageUrl) ||
                    (wizardStep === 2 && optionsRequired && validOptionCount < 2)
                  }
                  className="gap-1"
                >
                  下一步<ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  className="h-12 text-lg shadow-lg bg-gradient-to-r from-primary via-red-500 to-purple-600 hover:scale-[1.02] gap-2"
                  disabled={createQuestion.isPending || !canSubmit}
                >
                  {createQuestion.isPending ? <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />建立中…</> : <>🚀 建立問題</>}
                </Button>
              )}
            </div>
          ) : (
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
          )}

          {/* quick 模式的提示文字 */}
          {formMode === "quick" && !imageUrl && (
            <p className="text-sm text-muted-foreground text-center animate-fade-in">
              請先上傳或截取圖片
            </p>
          )}
          {formMode === "quick" && optionsRequired && validOptionCount < 2 && (
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditDialogOpen(true)}
                className="gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50"
                title="編輯題目（選項打錯時用）"
              >
                <Pencil className="w-4 h-4" />編輯題目
              </Button>
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
            {createdQuestion.questionType === "shortanswer" ? (
              <ShortAnswerLiveCloud questionId={createdQuestion.id} />
            ) : (
              <VotingStats question={createdQuestion} />
            )}
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
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <p className="text-sm font-medium text-gray-700">
                    {createdQuestion.questionType === "multiple"
                      ? "設定正確答案（可複選，全選對才算對）："
                      : "設定正確答案選項："}
                  </p>
                  {(createdQuestion.questionType === "multiple"
                    ? Array.isArray(createdQuestion.correctAnswers) && createdQuestion.correctAnswers.length > 0
                    : createdQuestion.correctAnswer !== null) && (
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                      已設定 {createdQuestion.questionType === "multiple" && Array.isArray(createdQuestion.correctAnswers)
                        ? `${createdQuestion.correctAnswers.length} 項`
                        : ""}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {createdQuestion.options.map((option: string, index: number) => {
                    const isMulti = createdQuestion.questionType === "multiple";
                    const isCorrect = isMulti
                      ? Array.isArray(createdQuestion.correctAnswers) && createdQuestion.correctAnswers.includes(index)
                      : createdQuestion.correctAnswer === index;
                    return (
                      <Button
                        key={index}
                        variant={isCorrect ? "default" : "outline"}
                        size="default"
                        onClick={() => isMulti ? toggleMultiCorrect.mutate(index) : setCorrectAnswer.mutate(index)}
                        disabled={setCorrectAnswer.isPending || toggleMultiCorrect.isPending}
                        className={`h-auto min-h-[3rem] p-3 text-left text-sm font-medium transition-all duration-200 ${
                          isCorrect
                            ? "bg-green-500 hover:bg-green-600 text-white shadow-lg transform hover:scale-105"
                            : "hover:bg-green-50 hover:border-green-300 hover:shadow-md active:scale-95"
                        }`}
                      >
                        <div className="w-full">
                          <div className="font-bold text-xs mb-1 flex items-center gap-1">
                            {isMulti && (
                              <span className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded border ${isCorrect ? "bg-white border-white" : "border-current opacity-60"}`}>
                                {isCorrect && <CheckCircle2 className="w-3 h-3 text-green-600" />}
                              </span>
                            )}
                            選項 {index + 1}
                          </div>
                          <div className="text-xs leading-tight break-words">
                            {option.length > 30 ? `${option.substring(0, 30)}...` : option}
                          </div>
                        </div>
                      </Button>
                    );
                  })}
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

      <EditQuestionDialog
        question={createdQuestion}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSaved={(updated) => setCreatedQuestion(updated)}
      />
    </div>
  );
}

/** 簡答題即時答案文字雲 — 訂閱 votes textAnswer 並顯示 */
function ShortAnswerLiveCloud({ questionId }: { questionId: string }) {
  const [answers, setAnswers] = useState<Array<{ id: string; text: string }>>([]);
  useEffect(() => {
    return firestore.listenToTextAnswers(questionId, (list) => setAnswers(list));
  }, [questionId]);
  return (
    <Card className="p-4 sm:p-6 card-hover bg-gradient-to-br from-purple-50 via-white to-pink-50 min-h-[280px]">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-purple-900 flex items-center gap-1.5">
          💬 即時答案文字雲
        </h3>
        <span className="text-xs text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full font-medium">
          {answers.length} 則
        </span>
      </div>
      <WordCloud answers={answers} minSize={16} maxSize={48} />
    </Card>
  );
}