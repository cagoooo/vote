import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
    answers: Array<{ id: string; text: string; userId?: string }>;
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
    "text-teal-600",
    "text-fuchsia-600",
    "text-lime-700",
    "text-red-600",
    "text-sky-600",
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
 * - 顏色依「裝置 userId」分色；同裝置永遠同色，不同裝置盡量不同色（局部唯一）
 * - 出現次數 ≥ 2 在右下角加 ×N 徽章
 */
export function WordCloud({ answers, minSize = 18, maxSize = 64, showEmptyState = true }: Props) {
    const entries = useMemo(() => {
        // 同樣的字會合併計數，但保留「第一個發送該字的裝置 userId」用於分色
        type Entry = { word: string; count: number; userId?: string; firstIdx: number };
        const map = new Map<string, Entry>();
        answers.forEach((a, idx) => {
            const trimmed = a.text.trim();
            if (!trimmed) return;
            const existing = map.get(trimmed);
            if (existing) {
                existing.count += 1;
            } else {
                map.set(trimmed, { word: trimmed, count: 1, userId: a.userId, firstIdx: idx });
            }
        });
        return Array.from(map.values()).sort((a, b) => b.count - a.count);
    }, [answers]);

    // 為每個 userId 配一個調色盤索引，依出現順序取色，盡量讓相鄰裝置不撞色
    const userColorIdx = useMemo(() => {
        const order: string[] = [];
        const seen = new Set<string>();
        // 依 firstIdx（送出順序）逐個分配
        [...entries]
            .sort((a, b) => a.firstIdx - b.firstIdx)
            .forEach((e) => {
                const key = e.userId || `__anon__${e.firstIdx}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    order.push(key);
                }
            });
        const map = new Map<string, number>();
        order.forEach((key, i) => map.set(key, i));
        return map;
    }, [entries]);

    if (entries.length === 0) {
        if (!showEmptyState) return null;
        return (
            <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
                等待學生答案中…
            </div>
        );
    }

    const maxCount = entries[0].count;
    const denom = Math.log10(maxCount + 1) || 1;
    const range = maxSize - minSize;

    return (
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 p-4 sm:p-6">
            <AnimatePresence>
                {entries.map(({ word, count, userId, firstIdx }) => {
                    const ratio = Math.log10(count + 1) / denom;
                    const fontSize = Math.round(minSize + ratio * range);
                    const key = userId || `__anon__${firstIdx}`;
                    const idx = userColorIdx.get(key);
                    // 有 userId 用配色順序；沒有就 fallback 用 word hash
                    const colorClass =
                        idx !== undefined
                            ? COLORS[idx % COLORS.length]
                            : COLORS[hashStr(word) % COLORS.length];
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
