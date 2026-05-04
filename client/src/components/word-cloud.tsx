import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
    answers: Array<{ id: string; text: string }>;
    /** Word 最小字級（px），預設 18 */
    minSize?: number;
    /** Word 最大字級（px），預設 64 */
    maxSize?: number;
    /** 是否顯示「等待答案中」placeholder */
    showEmptyState?: boolean;
}

const COLORS = [
    "text-blue-600",
    "text-emerald-600",
    "text-amber-600",
    "text-rose-600",
    "text-purple-600",
    "text-indigo-600",
    "text-cyan-600",
    "text-orange-600",
    "text-pink-600",
];

/** 簡單字串雜湊 → 取色 */
function hashStr(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
}

/**
 * 簡單版 word cloud：
 * - 不做中文分詞（教學量級答案多半短，整句當一個 entity 即可）
 * - 字級 = min + log10(count+1) * (max-min)/log10(maxCount+1)
 * - 顏色用字串 hash 取色，相同答案永遠同色（視覺穩定）
 * - 出現次數 ≥ 2 在右下角加 ×N 徽章
 */
export function WordCloud({ answers, minSize = 18, maxSize = 64, showEmptyState = true }: Props) {
    const counts = useMemo(() => {
        const map = new Map<string, number>();
        answers.forEach((a) => {
            const trimmed = a.text.trim();
            if (!trimmed) return;
            map.set(trimmed, (map.get(trimmed) || 0) + 1);
        });
        return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    }, [answers]);

    if (counts.length === 0) {
        if (!showEmptyState) return null;
        return (
            <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
                等待學生答案中…
            </div>
        );
    }

    const maxCount = counts[0][1];
    const denom = Math.log10(maxCount + 1) || 1;
    const range = maxSize - minSize;

    return (
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 p-4 sm:p-6">
            <AnimatePresence>
                {counts.map(([word, count]) => {
                    const ratio = Math.log10(count + 1) / denom;
                    const fontSize = Math.round(minSize + ratio * range);
                    const colorClass = COLORS[hashStr(word) % COLORS.length];
                    return (
                        <motion.span
                            layout
                            key={word}
                            initial={{ scale: 0.4, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 300, damping: 18 }}
                            className={`${colorClass} font-bold inline-flex items-baseline gap-1 select-none`}
                            style={{ fontSize: `${fontSize}px`, lineHeight: 1.05 }}
                        >
                            {word}
                            {count > 1 && (
                                <span className="text-xs sm:text-sm opacity-60 font-normal">×{count}</span>
                            )}
                        </motion.span>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}
