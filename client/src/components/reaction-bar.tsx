import { useRef, useState } from "react";
import { motion } from "framer-motion";
import * as firestore from "@/lib/firestore-voting";
import { useToast } from "@/hooks/use-toast";

interface Props {
    questionId: string;
}

const EMOJIS = firestore.REACTION_EMOJIS;
const COOLDOWN_MS = 1000;

/**
 * 學生端底部固定的表情反饋列。
 * - 5 顆按鈕：👍 ❤️ 😮 🤔 🎉
 * - 點擊後寫入 Firestore reactions collection
 * - Client-side debounce：每按鈕 1 秒冷卻，防洗版
 * - 老師的「課堂模式」會訂閱並做飛行動畫
 */
export function ReactionBar({ questionId }: Props) {
    const lastClickRef = useRef<Record<string, number>>({});
    const [pulse, setPulse] = useState<string | null>(null);
    const { toast } = useToast();

    const send = async (emoji: string) => {
        const last = lastClickRef.current[emoji] ?? 0;
        if (Date.now() - last < COOLDOWN_MS) return;
        lastClickRef.current[emoji] = Date.now();

        setPulse(emoji);
        window.setTimeout(() => setPulse(null), 250);

        try {
            await firestore.addReaction(questionId, emoji);
        } catch (err: any) {
            toast({ title: "送出失敗", description: err?.message ?? "請稍後再試", variant: "destructive" });
        }
    };

    // 注意：fixed 定位 + 置中放在外層普通 div，motion.div 只做入場動畫。
    // 否則 framer-motion 的 transform 會蓋掉 Tailwind 的 -translate-x-1/2，導致整個 bar 偏右。
    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40">
            <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-full shadow-lg px-2 py-1.5 flex items-center gap-1"
            >
                {EMOJIS.map((emoji) => (
                    <motion.button
                        key={emoji}
                        type="button"
                        onClick={() => send(emoji)}
                        whileTap={{ scale: 0.85 }}
                        animate={pulse === emoji ? { scale: [1, 1.4, 1], rotate: [0, 15, -15, 0] } : {}}
                        transition={{ duration: 0.3 }}
                        className="text-2xl sm:text-3xl p-2 rounded-full hover:bg-slate-100 transition-colors active:bg-slate-200"
                        aria-label={`送出 ${emoji}`}
                    >
                        {emoji}
                    </motion.button>
                ))}
            </motion.div>
        </div>
    );
}
