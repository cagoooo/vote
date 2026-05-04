import { useState, useEffect, useRef } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Button } from "@/components/ui/button";
import { RefreshCw, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Service Worker 更新提示
 *
 * 偵測到新版部署時，顯示底部置中的浮動 banner，
 * 使用者點「立即更新」會：
 *   1. 對 waiting SW 送 SKIP_WAITING（讓新版立刻接管）
 *   2. 監聽 controllerchange，一接管就 reload
 *   3. Fallback：1.5 秒沒接管也強制 reload（avoid hang）
 *
 * 用 prompt 模式（非 autoUpdate）避免：
 *  - infinite reload 雷
 *  - 學生正在投票時無預警 reload 投票流失
 */
export function SwUpdatePrompt() {
    const [dismissed, setDismissed] = useState(false);
    const [updating, setUpdating] = useState(false);
    const reloadedRef = useRef(false);
    const {
        needRefresh: [needRefresh],
    } = useRegisterSW({
        onRegistered(reg) {
            if (!reg) return;
            // 每 60 分鐘主動 check 一次新版（預設只在頁面 load 時 check）
            setInterval(() => {
                reg.update().catch(() => {});
            }, 60 * 60 * 1000);
        },
        onRegisterError(err) {
            console.warn("[PWA] SW register failed", err);
        },
    });

    useEffect(() => {
        if (needRefresh) {
            setDismissed(false);
            setUpdating(false);
            reloadedRef.current = false;
        }
    }, [needRefresh]);

    const doReload = () => {
        if (reloadedRef.current) return;
        reloadedRef.current = true;
        window.location.reload();
    };

    const handleUpdate = async () => {
        if (updating) return;
        setUpdating(true);

        // 1) 對 waiting SW 送 SKIP_WAITING
        try {
            if ("serviceWorker" in navigator) {
                const reg = await navigator.serviceWorker.getRegistration();
                if (reg?.waiting) {
                    reg.waiting.postMessage({ type: "SKIP_WAITING" });
                }
                // 2) controllerchange 一發生就 reload
                navigator.serviceWorker.addEventListener("controllerchange", doReload, { once: true });
            }
        } catch (err) {
            console.warn("[PWA] skipWaiting failed", err);
        }

        // 3) Fallback：1.5 秒內 controllerchange 沒發生就強制 reload
        window.setTimeout(doReload, 1500);
    };

    if (!needRefresh || dismissed) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                transition={{ type: "spring", damping: 20, stiffness: 200 }}
                className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[10000] w-[calc(100%-2rem)] max-w-md pointer-events-auto"
            >
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3">
                    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                        <RefreshCw className={`w-5 h-5 ${updating ? "animate-spin" : ""}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm">🚀 有新版可用</p>
                        <p className="text-xs text-blue-100">{updating ? "更新中…即將重新整理" : "點擊更新以使用最新功能"}</p>
                    </div>
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleUpdate}
                        disabled={updating}
                        className="bg-white text-blue-700 hover:bg-blue-50 disabled:opacity-70 font-semibold flex-shrink-0"
                    >
                        {updating ? "更新中…" : "立即更新"}
                    </Button>
                    <button
                        onClick={() => setDismissed(true)}
                        disabled={updating}
                        className="text-white/70 hover:text-white flex-shrink-0 p-1 disabled:opacity-50"
                        aria-label="稍後再說"
                        type="button"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}

/**
 * 版本號小徽章 — 左下角，灰色低調，debug 用
 */
export function VersionBadge() {
    const version = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";
    return (
        <div
            className="fixed bottom-2 left-2 z-[100] text-[10px] text-gray-400 hover:text-gray-600 font-mono select-none pointer-events-none"
            title={`版本：${version}`}
        >
            v{version}
        </div>
    );
}
