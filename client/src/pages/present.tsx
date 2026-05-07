import { useEffect, useRef, useState, useMemo } from "react";
import { useParams } from "wouter";
import QRCode from "react-qr-code";
import { motion, AnimatePresence } from "framer-motion";
import * as firestore from "@/lib/firestore-voting";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useVotingSound } from "@/hooks/use-voting-sounds";
import { useConfetti } from "@/hooks/use-confetti";
import { Maximize, Minimize, ArrowLeft, CheckCircle2, Crown, Volume2, VolumeX, ZoomIn, ZoomOut } from "lucide-react";
import { WordCloud } from "@/components/word-cloud";
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

// Playful Campus 字母色塊調色盤（與其他頁同步）
const OPT_PALETTES = [
    { dot: "#EF4444" },
    { dot: "#3B82F6" },
    { dot: "#F59E0B" },
    { dot: "#10B981" },
    { dot: "#8B5CF6" },
    { dot: "#F472B6" },
];

const CONFETTI_COOLDOWN_MS = 4000;

export default function Present() {
    const { id } = useParams<{ id: string }>();
    const [question, setQuestion] = useState<any | null>(null);
    const [stats, setStats] = useState<Record<number, number>>({});
    const [textAnswers, setTextAnswers] = useState<Array<{ id: string; text: string; userId?: string }>>([]);
    const [reactions, setReactions] = useState<any[]>([]);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [soundOn, setSoundOn] = useState(true);
    // QR 大小：S 200 / M 280 / L 360 / XL 460，記住老師偏好
    const QR_SIZES: Array<{ label: string; px: number }> = [
        { label: "S", px: 200 },
        { label: "M", px: 280 },
        { label: "L", px: 360 },
        { label: "XL", px: 460 },
    ];
    const [qrSizeIdx, setQrSizeIdx] = useState<number>(() => {
        const saved = localStorage.getItem("present_qr_size");
        const n = saved ? parseInt(saved, 10) : 0;
        return Number.isFinite(n) && n >= 0 && n < 4 ? n : 0;
    });
    const qrSize = QR_SIZES[qrSizeIdx].px;
    const setQrSize = (idx: number) => {
        const clamped = Math.max(0, Math.min(QR_SIZES.length - 1, idx));
        setQrSizeIdx(clamped);
        localStorage.setItem("present_qr_size", String(clamped));
    };
    const [popIdx, setPopIdx] = useState<number | null>(null); // 上次有票數變化的選項
    const idleTimer = useRef<number | null>(null);
    const lastTotalRef = useRef(0);
    const lastTopIdxRef = useRef<number | null>(null);
    const lastConfettiAtRef = useRef(0);
    const animatedReactionIds = useRef<Set<string>>(new Set());
    const lastSecondsLeftRef = useRef<number | null>(null);
    const { toast } = useToast();
    const { playVoteSubmitted, playVoteSessionStart } = useVotingSound();
    const { triggerConfetti } = useConfetti();

    // 倒數計時
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

    // 倒數結束音效（從 1 → 0 那一刻）
    useEffect(() => {
        const prev = lastSecondsLeftRef.current;
        if (prev !== null && prev > 0 && secondsLeft === 0 && soundOn) {
            playVoteSessionStart();
        }
        lastSecondsLeftRef.current = secondsLeft;
    }, [secondsLeft, soundOn, playVoteSessionStart]);

    // 訂閱題目、票數、表情
    useEffect(() => {
        if (!id) return;
        const unsubQ = firestore.listenToQuestion(id, (q) => setQuestion(q));
        const unsubV = firestore.getVotesStats(id, (s) => setStats(s));
        const unsubT = firestore.listenToTextAnswers(id, (list) => setTextAnswers(list));
        const unsubR = firestore.listenToReactions(id, (r) => setReactions(r));
        return () => {
            unsubQ();
            unsubV();
            unsubT();
            unsubR();
        };
    }, [id]);

    // 偵測新票數 / 第一名易主，觸發音效 + 動畫 + confetti
    useEffect(() => {
        const total = Object.values(stats).reduce((a, b) => a + b, 0);
        const prevTotal = lastTotalRef.current;

        // 找出當前 top 與上一個 top 的選項
        let topIdx: number | null = null;
        let topCount = 0;
        Object.entries(stats).forEach(([k, v]) => {
            if (v > topCount) {
                topCount = v;
                topIdx = Number(k);
            }
        });

        // 票數有增加（避免初始載入觸發）
        if (total > prevTotal && prevTotal !== 0) {
            // 找出哪個選項剛剛加票
            // 簡化：用 topIdx 作為「有變化的選項」用於 pop 動畫
            if (topIdx !== null) {
                setPopIdx(topIdx);
                window.setTimeout(() => setPopIdx(null), 600);
            }
            if (soundOn) playVoteSubmitted();

            // 第一名易主（且有實質票數差距才彈彩花）
            const prevTopIdx = lastTopIdxRef.current;
            if (
                topIdx !== null &&
                prevTopIdx !== null &&
                topIdx !== prevTopIdx &&
                topCount >= 2 && // 至少 2 票才算「超越」（防 0 vs 1 抖動）
                Date.now() - lastConfettiAtRef.current > CONFETTI_COOLDOWN_MS
            ) {
                triggerConfetti();
                lastConfettiAtRef.current = Date.now();
                if (soundOn) playVoteSessionStart();
            }
        }

        lastTotalRef.current = total;
        if (total > 0 && topIdx !== null) lastTopIdxRef.current = topIdx;
    }, [stats, soundOn, playVoteSubmitted, playVoteSessionStart, triggerConfetti]);

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

    // 找出所有「新出現」需要動畫的 reactions
    const newReactionsToAnimate = useMemo(() => {
        const fresh = reactions.filter((r) => !animatedReactionIds.current.has(r.id));
        fresh.forEach((r) => animatedReactionIds.current.add(r.id));
        return fresh;
    }, [reactions]);

    if (!question) {
        return (
            <div className="playful-shell min-h-screen flex items-center justify-center text-slate-700" style={{ background: "linear-gradient(180deg, #FEF9E7 0%, #EFF6FF 100%)" }}>
                <div className="text-center space-y-3">
                    <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="font-bold">載入題目中…</p>
                </div>
            </div>
        );
    }

    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    const showAnswer: boolean = !!question.showAnswer;
    const correctIdx: number | null = question.correctAnswer ?? null;
    const voteUrl = `${window.location.origin}${import.meta.env.BASE_URL}${id}`;

    // 計算當前最高票（給金冠標示用）
    let topIdx: number | null = null;
    let topCount = 0;
    Object.entries(stats).forEach(([k, v]) => {
        if (v > topCount) {
            topCount = v;
            topIdx = Number(k);
        }
    });

    return (
        <div
            className={`playful-shell relative min-h-screen overflow-hidden ${
                showControls ? "" : "cursor-none"
            }`}
            style={{ background: "linear-gradient(180deg, #FEF9E7 0%, #EFF6FF 100%)" }}
        >
            {/* 浮動表情層 */}
            <div className="fixed inset-0 pointer-events-none z-30 overflow-hidden">
                <AnimatePresence>
                    {newReactionsToAnimate.map((r) => {
                        const startX = 20 + Math.random() * 60; // 20%~80%
                        const drift = (Math.random() - 0.5) * 30; // 飄移 ±15%
                        return (
                            <motion.div
                                key={r.id}
                                initial={{ y: "100vh", x: `${startX}vw`, opacity: 0, scale: 0.5, rotate: 0 }}
                                animate={{
                                    y: "-10vh",
                                    x: `${startX + drift}vw`,
                                    opacity: [0, 1, 1, 0],
                                    scale: [0.5, 1.4, 1.2, 1],
                                    rotate: [0, 15, -15, 0],
                                }}
                                transition={{ duration: 4, ease: "easeOut" }}
                                className="absolute text-6xl select-none"
                                style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.15))" }}
                            >
                                {r.emoji}
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            {/* 頂部控制列 */}
            <AnimatePresence>
                {showControls && (
                    <motion.div
                        initial={{ y: -50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -50, opacity: 0 }}
                        className="playful-topbar fixed top-0 left-0 right-0 z-50 px-4 py-2 flex items-center justify-between gap-2"
                    >
                        <Link href={`/?q=${id}`}>
                            <Button variant="ghost" size="sm" className="gap-1.5 rounded-full bg-white shadow-sm hover:bg-blue-50 text-slate-700 font-bold border border-slate-200">
                                <ArrowLeft className="w-4 h-4" />回管理介面
                            </Button>
                        </Link>
                        <div className="text-xs text-slate-500 hidden sm:block font-bold">
                            {total > 0 ? `${total} 人已投票` : "等待投票…"}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSoundOn(!soundOn)}
                                title={soundOn ? "靜音" : "開啟音效"}
                                className="gap-1 rounded-full bg-white shadow-sm hover:bg-blue-50 text-slate-700"
                            >
                                {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
                            </Button>
                            <Button variant="outline" size="sm" onClick={toggleFullscreen} className="gap-1.5 rounded-full bg-white shadow-sm hover:bg-blue-50 text-slate-700 font-bold border border-slate-200">
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
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 p-6 lg:p-10 pt-20 min-h-screen">
                {/* 左：題目 + 即時統計 */}
                <div className="space-y-6 min-w-0">
                    {/* Playful 投票進行中 chip */}
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-100">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-playful-pulse" />
                        <span className="text-sm font-extrabold text-red-600">投票進行中</span>
                    </div>

                    {question.imageUrl && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white rounded-3xl shadow-xl p-4 sm:p-6"
                        >
                            <img
                                src={question.imageUrl}
                                alt="題目"
                                className="w-full max-h-[40vh] object-contain rounded-2xl"
                            />
                        </motion.div>
                    )}

                    {question.questionType === "shortanswer" ? (
                        <div className="bg-white rounded-3xl shadow-xl p-4 sm:p-6 min-h-[40vh]">
                            <div className="text-center text-sm text-slate-500 mb-2">
                                💬 即時答案文字雲（{textAnswers.length} 則）
                            </div>
                            <WordCloud answers={textAnswers} minSize={24} maxSize={84} />
                        </div>
                    ) : (
                    <div className="space-y-3">
                        {question.options.map((opt: string, i: number) => {
                            const palette = OPT_PALETTES[i % OPT_PALETTES.length];
                            const count = stats[i] || 0;
                            const pct = total ? (count / total) * 100 : 0;
                            const isCorrect = showAnswer && correctIdx === i;
                            const isTop = total > 0 && topIdx === i;
                            const justChanged = popIdx === i;
                            return (
                                <motion.div
                                    key={i}
                                    layout
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.04 }}
                                    className={`relative bg-white rounded-2xl overflow-hidden transition-all duration-300 shadow-md ${
                                        isCorrect
                                            ? "ring-4 ring-emerald-400 shadow-emerald-200/50 shadow-2xl"
                                            : isTop
                                                ? "ring-2 ring-amber-300 shadow-amber-200/40 shadow-xl"
                                                : ""
                                    }`}
                                >
                                    {/* 進度條背景：Playful 淡色填底 */}
                                    <motion.div
                                        layout
                                        className="absolute inset-y-0 left-0"
                                        style={{
                                            background: isCorrect
                                                ? "linear-gradient(90deg, #10B98140, #10B98115)"
                                                : isTop
                                                    ? "linear-gradient(90deg, #F59E0B40, #F59E0B15)"
                                                    : `linear-gradient(90deg, ${palette.dot}40, ${palette.dot}15)`,
                                        }}
                                        initial={{ width: "0%" }}
                                        animate={{ width: `${pct}%` }}
                                        transition={{ duration: 0.6, ease: "easeOut" }}
                                    />
                                    <div className="relative flex items-center gap-4 p-4 sm:p-5">
                                        <motion.div
                                            animate={justChanged ? { scale: [1, 1.2, 1] } : {}}
                                            transition={{ duration: 0.5 }}
                                            className="flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-2xl text-white font-extrabold text-2xl sm:text-3xl grid place-items-center shadow-md relative"
                                            style={{ background: isCorrect ? "#10B981" : isTop ? "#F59E0B" : palette.dot }}
                                        >
                                            {String.fromCharCode(65 + i)}
                                            {isTop && total >= 2 && !isCorrect && (
                                                <motion.div
                                                    initial={{ scale: 0, rotate: -30 }}
                                                    animate={{ scale: 1, rotate: 0 }}
                                                    className="absolute -top-2 -right-2 bg-amber-400 rounded-full p-0.5 shadow"
                                                >
                                                    <Crown className="w-3.5 h-3.5 text-amber-900" />
                                                </motion.div>
                                            )}
                                        </motion.div>
                                        <div className="flex-1 min-w-0 text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 break-words">
                                            {opt}
                                            {isCorrect && (
                                                <CheckCircle2 className="inline-block w-7 h-7 ml-2 text-emerald-600" />
                                            )}
                                        </div>
                                        <div className="flex-shrink-0 text-right">
                                            <motion.div
                                                key={count}
                                                initial={justChanged ? { scale: 1.6, color: "#10B981" } : false}
                                                animate={{ scale: 1, color: "#0F172A" }}
                                                transition={{ duration: 0.5, type: "spring" }}
                                                className="text-3xl sm:text-4xl lg:text-5xl font-black tabular-nums"
                                            >
                                                {pct.toFixed(0)}<span className="text-lg sm:text-xl text-slate-500">%</span>
                                            </motion.div>
                                            <div className="text-sm text-slate-500 tabular-nums">
                                                {count} 票
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                    )}
                </div>

                {/* 右：倒數 + QR + 房間代碼 + 總票數 */}
                <div className="flex-shrink-0 space-y-4" style={{ minWidth: 320, width: `min(${qrSize + 80}px, 100%)` }}>
                    {secondsLeft !== null && (
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className={`rounded-3xl shadow-xl p-6 text-center text-white ${
                                secondsLeft === 0
                                    ? "bg-gradient-to-br from-slate-400 to-slate-500"
                                    : secondsLeft <= 10
                                        ? "bg-gradient-to-br from-red-500 to-rose-500 animate-pulse"
                                        : "bg-gradient-to-br from-amber-400 to-orange-500"
                            }`}
                        >
                            <div className="text-sm font-medium opacity-90">⏱ 剩餘時間</div>
                            <motion.div
                                key={secondsLeft}
                                initial={{ scale: 1.5, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: "spring", stiffness: 300, damping: 18 }}
                                className="text-7xl font-black tabular-nums mt-1 drop-shadow-lg"
                            >
                                {secondsLeft === 0 ? "結束" : secondsLeft}
                            </motion.div>
                            {secondsLeft > 0 && <div className="text-xs opacity-75 mt-1">秒</div>}
                        </motion.div>
                    )}
                    <div className="bg-white rounded-3xl shadow-xl p-6 text-center space-y-4">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-slate-500 font-extrabold uppercase tracking-widest">掃 QR 加入投票</span>
                            <div className="flex items-center gap-1 bg-slate-100 rounded-md p-0.5">
                                <button
                                    type="button"
                                    onClick={() => setQrSize(qrSizeIdx - 1)}
                                    disabled={qrSizeIdx === 0}
                                    className="p-1.5 rounded hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                    title="縮小 QR"
                                >
                                    <ZoomOut className="w-3.5 h-3.5 text-slate-600" />
                                </button>
                                <span className="text-xs font-mono font-bold text-slate-700 min-w-[1.5rem] text-center">
                                    {QR_SIZES[qrSizeIdx].label}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setQrSize(qrSizeIdx + 1)}
                                    disabled={qrSizeIdx === QR_SIZES.length - 1}
                                    className="p-1.5 rounded hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                    title="放大 QR"
                                >
                                    <ZoomIn className="w-3.5 h-3.5 text-slate-600" />
                                </button>
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-2xl mx-auto inline-block transition-all duration-300 shadow-inner">
                            <QRCode value={voteUrl} size={qrSize} />
                        </div>
                        {question.roomCode && (
                            <div className="rounded-2xl p-4" style={{ background: "linear-gradient(135deg,#EFF6FF,#FCE7F3)" }}>
                                <div className="text-xs text-slate-600 font-bold mb-1">或輸入房間代碼</div>
                                <div className="font-mono text-5xl font-black tracking-[0.3em] text-blue-900">
                                    {question.roomCode}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="rounded-3xl shadow-xl p-6 text-center text-white" style={{ background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)" }}>
                        <div className="text-xs font-extrabold uppercase tracking-widest opacity-90">已參與</div>
                        <motion.div
                            key={total}
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: "spring", stiffness: 260, damping: 15 }}
                            className="text-7xl font-black tabular-nums mt-2 drop-shadow-lg"
                        >
                            {total}
                        </motion.div>
                        <div className="text-xs opacity-80 mt-1">人已投票</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
