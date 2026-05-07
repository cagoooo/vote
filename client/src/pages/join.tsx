import { useState } from "react";
import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import * as firestore from "@/lib/firestore-voting";
import { ArrowLeft, KeyRound, Loader2 } from "lucide-react";

export default function Join() {
  const [, setLocation] = useLocation();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) {
      toast({ title: "代碼太短", description: "請輸入完整的 4 碼房間代碼", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const q = await firestore.findQuestionByRoomCode(trimmed);
      if (!q) {
        toast({ title: "找不到房間", description: "請確認代碼是否正確", variant: "destructive" });
        return;
      }
      setLocation(`/${q.id}`);
    } catch (err: any) {
      toast({ title: "查詢失敗", description: err.message ?? "請稍後再試", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="playful-shell">
      <div className="page-container max-w-md">
        <div className="mb-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1.5 rounded-full bg-white shadow-sm hover:bg-blue-50 text-slate-700 font-bold border border-slate-200">
              <ArrowLeft className="w-4 h-4" />回首頁
            </Button>
          </Link>
        </div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="playful-card p-8 space-y-6 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-100 flex items-center justify-center">
              <KeyRound className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <div className="text-[13px] text-blue-700 font-extrabold mb-1">🔑 輸入房間代碼</div>
              <h1 className="text-2xl font-extrabold text-slate-900 leading-tight tracking-tight">加入老師的投票</h1>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                老師會給你 4 碼代碼（例如 K3X7），輸入後即可進入投票
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="K3X7"
                maxLength={6}
                autoFocus
                autoComplete="off"
                spellCheck={false}
                inputMode="text"
                className="h-16 text-center text-3xl font-mono tracking-[0.5em] uppercase rounded-2xl border-2 border-slate-200 bg-white font-extrabold focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:ring-offset-0"
              />
              <Button type="submit" disabled={loading || code.trim().length < 4} className="playful-cta w-full h-14 text-lg rounded-2xl gap-2" size="lg">
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />查詢中…
                  </>
                ) : (
                  <>🚀 進入投票</>
                )}
              </Button>
            </form>

            <p className="text-xs text-slate-400">代碼不分大小寫，且不會出現容易混淆的字元（0、O、1、I、L）</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
