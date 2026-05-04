import { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import QRCode from "react-qr-code";
import { motion, AnimatePresence } from "framer-motion";
import * as firestore from "@/lib/firestore-voting";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Maximize, Minimize, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";

const COLORS = [
    "from-blue-500 to-blue-600",
    "from-emerald-500 to-emerald-600",
    "from-amber-500 to-amber-600",
    "from-rose-500 to-rose-600",
    "from-purple-500 to-purple-600",
    "from-cyan-500 to-cyan-600",
    "from-orange-500 to-orange-600",
    "from-pink-500 to-pink-600",
];

export default function Present() {
    const { id } = useParams<{ id: string }>();
    const [question, setQuestion] = useState<any | null>(null);
    const [stats, setStats] = useState<Record<number, number>>({});
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const idleTimer = useRef<number | null>(null);
    const { toast } = useToast();

    // 訂閱題目與票數
    useEffect(() => {
        if (!id) return;
        const unsubQ = firestore.listenToQuestion(id, (q) => setQuestion(q));
        const unsubV = firestore.getVotesStats(id, (s) => setStats(s));
        return () => {
            unsubQ();
            unsubV();
        };
    }, [id]);

    // 全螢幕狀態同步
    useEffect(() => {
        const onFs = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener("fullscreenchange", onFs);
        return () => document.removeEventListener("fullscreenchange", onFs);
    }, []);

    // 滑鼠閒置 3 秒後自動隱藏控制元件
    useEffect(() => {
        const wake = () => {
            setShowControls(true);
            if (idleTimer.current) window.clearTimeout(idleTimer.current);
            idleTimer.current = window.setTimeout(() => setShowControls(false), 3000);
        };
        wake();
        window.addEventListener("mousemove", wake);
        window.addEventListener("touchstart", wake);
        return () => {
            window.removeEventListener("mousemove", wake);
            window.removeEventListener("touchstart", wake);
            if (idleTimer.current) window.clearTimeout(idleTimer.current);
        };
    }, []);

    const toggleFullscreen = async () => {
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
            } else {
                await document.documentElement.requestFullscreen();
            }
        } catch (err: any) {
            toast({ title: "無法切換全螢幕", description: err.message, variant: "destructive" });
        }
    };

    if (!question) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-300">
                <div className="text-center space-y-3">
                    <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p>載入題目中…</p>
                </div>
            </div>
        );
    }

    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    const showAnswer: boolean = !!question.showAnswer;
    const correctIdx: number | null = question.correctAnswer ?? null;
    const voteUrl = `${window.location.origin}${import.meta.env.BASE_URL}${id}`;

    return (
        <div
            className={`min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 ${
                showControls ? "" : "cursor-none"
            }`}
        >
            {/* 頂部控制列：閒置自動隱藏 */}
            <AnimatePresence>
                {showControls && (
                    <motion.div
                        initial={{ y: -50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -50, opacity: 0 }}
                        className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-2"
                    >
                        <Link href={`/?q=${id}`}>
                            <Button variant="ghost" size="sm" className="gap-1">
                                <ArrowLeft className="w-4 h-4" />回管理介面
                            </Button>
                        </Link>
                        <div className="text-xs text-slate-500">
                            {total > 0 && `${total} 人已投票 · `}
                            {showControls && "滑鼠靜止 3 秒自動隱藏"}
                        </div>
                        <Button variant="outline" size="sm" onClick={toggleFullscreen} className="gap-1">
                            {isFullscreen ? (
                                <>
                                    <Minimize className="w-4 h-4" />離開全螢幕
                                </>
                            ) : (
                                <>
                                    <Maximize className="w-4 h-4" />全螢幕
                                </>
                            )}
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 p-6 lg:p-10 pt-20 min-h-screen">
                {/* 左：題目 + 即時統計 */}
                <div className="space-y-6 min-w-0">
                    {question.imageUrl && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white rounded-2xl shadow-xl p-4 sm:p-6"
                        >
                            <img
                                src={question.imageUrl}
                                alt="題目"
                                className="w-full max-h-[40vh] object-contain rounded-lg"
                            />
                        </motion.div>
                    )}

                    <div className="space-y-3">
                        {question.options.map((opt: string, i: number) => {
                            const count = stats[i] || 0;
                            const pct = total ? (count / total) * 100 : 0;
                            const isCorrect = showAnswer && correctIdx === i;
                            return (
                                <motion.div
                                    key={i}
                                    layout
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.04 }}
                                    className={`relative bg-white rounded-xl shadow-md overflow-hidden ${
                                        isCorrect ? "ring-4 ring-green-400" : ""
                                    }`}
                                >
                                    {/* 進度條背景 */}
                                    <motion.div
                                        layout
                                        className={`absolute inset-y-0 left-0 bg-gradient-to-r ${
                                            isCorrect ? "from-green-400 to-emerald-500" : COLORS[i % COLORS.length]
                                        } opacity-25`}
                                        initial={{ width: "0%" }}
                                        animate={{ width: `${pct}%` }}
                                        transition={{ duration: 0.6, ease: "easeOut" }}
                                    />
                                    <div className="relative flex items-center gap-4 p-4 sm:p-5">
                                        <div
                                            className={`flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br ${COLORS[i % COLORS.length]} text-white font-bold text-xl sm:text-2xl flex items-center justify-center shadow-md`}
                                        >
                                            {i + 1}
                                        </div>
                                        <div className="flex-1 min-w-0 text-xl sm:text-2xl lg:text-3xl font-semibold text-slate-800 break-words">
                                            {opt}
                                            {isCorrect && (
                                                <CheckCircle2 className="inline-block w-7 h-7 ml-2 text-green-600" />
                                            )}
                                        </div>
                                        <div className="flex-shrink-0 text-right">
                                            <div className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-700 tabular-nums">
                                                {count}
                                            </div>
                                            <div className="text-sm text-slate-500 tabular-nums">
                                                {pct.toFixed(0)}%
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>

                {/* 右：QR + 房間代碼 + 總票數 */}
                <div className="lg:w-80 flex-shrink-0 space-y-4">
                    <div className="bg-white rounded-2xl shadow-xl p-6 text-center space-y-4">
                        <div className="text-sm text-slate-500 font-medium">掃 QR 進入投票</div>
                        <div className="bg-white p-3 rounded-lg shadow-inner mx-auto inline-block">
                            <QRCode value={voteUrl} size={200} />
                        </div>
                        {question.roomCode && (
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-100 border border-blue-200 rounded-xl p-4">
                                <div className="text-xs text-blue-700 font-medium mb-1">或輸入房間代碼</div>
                                <div className="font-mono text-5xl font-black tracking-[0.3em] text-blue-900">
                                    {question.roomCode}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-2xl shadow-xl p-6 text-center">
                        <div className="text-sm font-medium opacity-90">即時投票數</div>
                        <motion.div
                            key={total}
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="text-7xl font-black tabular-nums mt-2"
                        >
                            {total}
                        </motion.div>
                        <div className="text-xs opacity-75 mt-1">人已投票</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
