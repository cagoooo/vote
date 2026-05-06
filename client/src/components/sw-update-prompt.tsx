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
 *   1. 先註冊 controllerchange listener（要在 SKIP_WAITING 之前，避免 race）
 *   2. 對 waiting SW 送 SKIP_WAITING + 監聽其 statechange === "activated"
 *   3. 任一觸發就 reload
 *   4. Fallback：5 秒沒接管也強制 reload（手機 SKIP_WAITING 常 >1.5s）
 *
 * 抑制期（核心防止「按完更新又跳」）：
 *   按下更新時在 sessionStorage 寫旗標，reload 後 mount 偵測到旗標
 *   就 30 秒內不顯示提示，給新 SW 充裕時間完全 settle
 */
const SUPPRESS_KEY = "sw_just_updated_at";
const SUPPRESS_MS = 30_000;

export function SwUpdatePrompt() {
    const [dismissed, setDismissed] = useState(false);
    const [updating, setUpdating] = useState(false);
    // mount 時讀 sessionStorage：剛剛按過更新且 reload 完，30 秒內抑制提示
    const [suppressed, setSuppressed] = useState<boolean>(() => {
        if (typeof sessionStorage === "undefined") return false;
        const ts = Number(sessionStorage.getItem(SUPPRESS_KEY));
        if (!ts) return false;
        const elapsed = Date.now() - ts;
        if (elapsed > SUPPRESS_MS) {
            sessionStorage.removeItem(SUPPRESS_KEY);
            return false;
        }
        return true;
    });
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

    // 抑制期過了自動解除（讓使用者真的有新版時還能看到提示）
    useEffect(() => {
        if (!suppressed) return;
        const ts = Number(sessionStorage.getItem(SUPPRESS_KEY)) || 0;
        const remain = Math.max(0, SUPPRESS_MS - (Date.now() - ts));
        const t = window.setTimeout(() => {
            sessionStorage.removeItem(SUPPRESS_KEY);
            setSuppressed(false);
        }, remain);
        return () => window.clearTimeout(t);
    }, [suppressed]);

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
        // 寫旗標再 reload，重整後 mount 期間會抑制提示
        try {
            sessionStorage.setItem(SUPPRESS_KEY, String(Date.now()));
        } catch { /* sessionStorage 可能被 disable */ }
        window.location.reload();
    };

    const handleUpdate = async () => {
        if (updating) return;
        setUpdating(true);

        try {
            if ("serviceWorker" in navigator) {
                // 1) 監聽要在 postMessage 之前註冊好，避免 SKIP_WAITING 處理超快錯過事件
                navigator.serviceWorker.addEventListener("controllerchange", doReload, { once: true });

                const reg = await navigator.serviceWorker.getRegistration();
                if (reg?.waiting) {
                    // 2) 雙保險：監聽 waiting SW 的 state 變 activated 也觸發 reload
                    const waiting = reg.waiting;
                    const onState = () => {
                        if (waiting.state === "activated") doReload();
                    };
                    waiting.addEventListener("statechange", onState);
                    waiting.postMessage({ type: "SKIP_WAITING" });
                }
            }
        } catch (err) {
            console.warn("[PWA] skipWaiting failed", err);
        }

        // 3) Fallback：5 秒（手機 SKIP_WAITING 處理常 >1.5s）
        window.setTimeout(doReload, 5000);
    };

    if (!needRefresh || dismissed || suppressed) return null;

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
