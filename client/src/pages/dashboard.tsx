import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, signInWithGoogle } from "@/lib/firebase";
import * as firestore from "@/lib/firestore-voting";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Eye,
  LogIn,
  PlayCircle,
  Trash2,
  Users,
  AlertTriangle,
  Calendar,
  Loader2,
} from "lucide-react";

function formatDate(ts: any): string {
  if (!ts?.toMillis) return "—";
  const d = new Date(ts.toMillis());
  const now = Date.now();
  const diff = now - d.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "剛剛";
  if (minutes < 60) return `${minutes} 分鐘前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小時前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  return d.toLocaleDateString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export default function Dashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setCurrentUser(u);
        setAuthReady(true);
      }),
    []
  );

  const isLoggedIn = currentUser && !currentUser.isAnonymous;

  const questionsQuery = useQuery({
    queryKey: ["my-questions", currentUser?.uid],
    queryFn: () => firestore.listMyQuestions(),
    enabled: !!isLoggedIn,
  });

  const voteCountsQuery = useQuery({
    queryKey: ["vote-counts", currentUser?.uid, questionsQuery.data?.map((q) => q.id).join(",")],
    queryFn: () => firestore.getVoteCountsForQuestions((questionsQuery.data ?? []).map((q) => q.id)),
    enabled: !!questionsQuery.data && questionsQuery.data.length > 0,
  });

  const reactivate = useMutation({
    mutationFn: (id: string) => firestore.reactivateQuestion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-questions"] });
      toast({ title: "已重新啟用", description: "此題現在是進行中的活動投票", variant: "success" });
    },
    onError: (err: Error) => toast({ title: "啟用失敗", description: err.message, variant: "destructive" }),
  });

  const deleteQuestion = useMutation({
    mutationFn: (id: string) => firestore.deleteQuestion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-questions"] });
      queryClient.invalidateQueries({ queryKey: ["vote-counts"] });
      toast({ title: "已刪除", description: "題目與所有投票記錄已移除" });
    },
    onError: (err: Error) => toast({ title: "刪除失敗", description: err.message, variant: "destructive" }),
  });

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (err: any) {
      if (err?.code === "auth/popup-closed-by-user" || err?.code === "auth/cancelled-popup-request") return;
      toast({ title: "登入失敗", description: err?.message ?? "請稍後再試", variant: "destructive" });
    }
  };

  const handleViewQuestion = (id: string) => {
    setLocation(`/?q=${id}`);
  };

  if (!authReady) {
    return (
      <div className="page-container flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="page-container max-w-xl">
        <div className="mb-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="w-4 h-4" />回首頁
            </Button>
          </Link>
        </div>
        <Card className="p-8 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-blue-100 flex items-center justify-center">
            <LogIn className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold gradient-text">需要登入</h1>
          <p className="text-gray-600">
            「我的題目」需要 Google 登入才能存取，這樣換裝置也找得到你的歷史題目。
          </p>
          <Button onClick={handleGoogleSignIn} size="lg" className="gap-2">
            <LogIn className="w-4 h-4" />使用 Google 登入
          </Button>
          <p className="text-xs text-gray-400">若你之前用匿名身份建過題目，登入後會自動繼承擁有權。</p>
        </Card>
      </div>
    );
  }

  const questions = questionsQuery.data ?? [];
  const voteCounts = voteCountsQuery.data ?? {};

  return (
    <div className="page-container max-w-5xl">
      <div className="flex items-center justify-between mb-6 gap-2">
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="w-4 h-4" />回首頁
          </Button>
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold gradient-text">我的題目</h1>
        <div className="text-sm text-gray-500">共 {questions.length} 題</div>
      </div>

      {questionsQuery.isLoading ? (
        <div className="text-center py-16">
          <Loader2 className="w-10 h-10 animate-spin mx-auto text-gray-400" />
          <p className="mt-3 text-gray-500">載入題目中…</p>
        </div>
      ) : questions.length === 0 ? (
        <Card className="p-12 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-gray-100 flex items-center justify-center">
            <Calendar className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-700">還沒有題目</h2>
          <p className="text-gray-500">去首頁建立你的第一個投票吧！</p>
          <Link href="/">
            <Button>前往建立題目</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {questions.map((q) => {
              const expired = firestore.isQuestionExpired(q);
              const isActive = q.active && !expired;
              const totalVotes = voteCounts[q.id] ?? 0;

              return (
                <motion.div
                  key={q.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.25 }}
                >
                  <Card className="overflow-hidden h-full flex flex-col card-hover">
                    <div className="relative aspect-[4/3] bg-gray-50 overflow-hidden">
                      {q.imageUrl ? (
                        <img src={q.imageUrl} alt="" className="w-full h-full object-contain" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">
                          無圖片
                        </div>
                      )}
                      <div className="absolute top-2 left-2 flex flex-col gap-1">
                        {isActive && (
                          <Badge className="bg-green-500 hover:bg-green-500 text-white shadow gap-1">
                            <PlayCircle className="w-3 h-3" />進行中
                          </Badge>
                        )}
                        {q.active && expired && (
                          <Badge className="bg-amber-500 hover:bg-amber-500 text-white shadow gap-1">
                            <AlertTriangle className="w-3 h-3" />已過期
                          </Badge>
                        )}
                        {!q.active && (
                          <Badge variant="secondary" className="shadow gap-1">
                            <Clock className="w-3 h-3" />已停用
                          </Badge>
                        )}
                        {q.correctAnswer !== null && q.correctAnswer !== undefined && (
                          <Badge className="bg-blue-500 hover:bg-blue-500 text-white shadow gap-1">
                            <CheckCircle2 className="w-3 h-3" />已設答案
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="p-4 flex-1 flex flex-col gap-3">
                      <div className="space-y-1">
                        {q.options.slice(0, 4).map((opt, i) => (
                          <div
                            key={i}
                            className={`text-sm px-2 py-1 rounded ${
                              i === q.correctAnswer
                                ? "bg-blue-50 text-blue-900 font-medium"
                                : "bg-gray-50 text-gray-700"
                            }`}
                          >
                            <span className="text-gray-400 mr-1.5">{i + 1}.</span>
                            <span className="truncate inline-block align-bottom max-w-[85%]">{opt}</span>
                          </div>
                        ))}
                        {q.options.length > 4 && (
                          <div className="text-xs text-gray-400 px-2">+{q.options.length - 4} 個選項…</div>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs text-gray-500 pt-1 border-t">
                        <div className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          <span className="font-semibold text-gray-700">{totalVotes}</span> 票
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDate(q.createdAt)}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mt-auto">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewQuestion(q.id)}
                          className="flex-1 gap-1 min-w-0"
                        >
                          <Eye className="w-3.5 h-3.5" />查看
                        </Button>
                        {!isActive && (
                          <Button
                            size="sm"
                            onClick={() => reactivate.mutate(q.id)}
                            disabled={reactivate.isPending}
                            className="flex-1 gap-1 min-w-0 bg-green-600 hover:bg-green-700"
                          >
                            <PlayCircle className="w-3.5 h-3.5" />啟用
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`確定要刪除這題嗎？此題的 ${totalVotes} 筆投票記錄也會一起刪除，無法復原。`)) {
                              deleteQuestion.mutate(q.id);
                            }
                          }}
                          disabled={deleteQuestion.isPending}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          title="刪除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
