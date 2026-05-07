import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles } from "lucide-react";

// 全域防重複點擊標記
let isGlobalClicking = false;

export function FloatingAdButton() {
  const [isVisible, setIsVisible] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const lastClickTime = useRef(0);

  if (!isVisible) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const now = Date.now();
    
    // 防止重複點擊 - 使用時間戳和全域標記雙重保護
    if (isGlobalClicking || now - lastClickTime.current < 2000) {
      return;
    }
    
    lastClickTime.current = now;
    isGlobalClicking = true;
    
    const url = "https://document-ai-companion-ipad4.replit.app";
    
    try {
      // 直接使用 window.open，避免雙重執行
      const newWindow = window.open(url, "_blank", "noopener,noreferrer");
      
      if (newWindow) {
        newWindow.focus();
      }
    } catch (error) {
      console.error("開啟連結錯誤:", error);
    }
    
    // 2秒後重新允許點擊
    setTimeout(() => {
      isGlobalClicking = false;
    }, 2000);
  };

  const handleClose = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 100 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 100 }}
          className="fixed bottom-6 right-6 z-[9999]"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* 背景光暈效果 — Playful 藍紫粉柔光 */}
          <div
            className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 blur-md opacity-50 pointer-events-none"
            style={{
              zIndex: -1,
              transform: isHovered ? 'scale(1.1)' : 'scale(1)',
              transition: 'transform 0.3s ease'
            }}
          />

          {/* 關閉按鈕 */}
          <button
            onClick={handleClose}
            className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-white text-slate-500 rounded-full
                     flex items-center justify-center text-xs hover:bg-slate-50 hover:text-red-500 transition-colors z-[10000]
                     shadow-md border border-slate-200"
            aria-label="關閉廣告"
          >
            <X size={11} />
          </button>

          {/* 簡化的主按鈕 - 直接可點擊（Playful 藍紫漸層） */}
          <button
            onClick={handleClick}
            className="relative rounded-2xl p-3 shadow-2xl border border-white/30
                      w-40 md:w-44 text-center cursor-pointer z-[9999]
                      transform hover:scale-105 transition-all duration-200
                      active:scale-95 block"
            style={{
              position: 'relative',
              zIndex: 9999,
              background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 50%, #F472B6 100%)',
            }}
          >
            {/* 按鈕內容 */}
            <div className="text-white pointer-events-none">
              <div className="text-sm md:text-base font-bold mb-1">
                創建專屬助手
              </div>
              <div className="text-lg md:text-xl mb-1">🦄</div>
              <div className="text-xs opacity-90">
                點擊開始使用
              </div>
            </div>

            {/* 閃爍星星 */}
            <div className="absolute top-1 right-1 pointer-events-none">
              <Sparkles 
                className="text-yellow-300 w-3 h-3 md:w-4 md:h-4 animate-pulse" 
              />
            </div>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}