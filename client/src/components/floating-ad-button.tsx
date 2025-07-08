import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles } from "lucide-react";

export function FloatingAdButton() {
  const [isVisible, setIsVisible] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isClicking, setIsClicking] = useState(false);

  if (!isVisible) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 防止重複點擊
    if (isClicking) return;
    
    setIsClicking(true);
    
    const url = "https://document-ai-companion-ipad4.replit.app";
    
    try {
      const newWindow = window.open(url, "_blank", "noopener,noreferrer");
      
      if (!newWindow) {
        // 彈出視窗被阻擋，使用備用方案
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error("開啟連結錯誤:", error);
    } finally {
      // 1秒後重新允許點擊
      setTimeout(() => {
        setIsClicking(false);
      }, 1000);
    }
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
          {/* 背景光暈效果 */}
          <div 
            className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 blur-md opacity-60 pointer-events-none"
            style={{ 
              zIndex: -1,
              transform: isHovered ? 'scale(1.1)' : 'scale(1)',
              transition: 'transform 0.3s ease'
            }}
          />

          {/* 關閉按鈕 */}
          <button
            onClick={handleClose}
            className="absolute -top-1 -right-1 w-5 h-5 bg-gray-800 text-white rounded-full 
                     flex items-center justify-center text-xs hover:bg-gray-700 transition-colors z-[10000]
                     shadow-lg border border-gray-600"
          >
            <X size={10} />
          </button>

          {/* 簡化的主按鈕 - 直接可點擊 */}
          <button
            onClick={handleClick}

            className="relative bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 
                      rounded-xl p-3 shadow-2xl border border-white/20
                      w-40 md:w-44 text-center cursor-pointer z-[9999]
                      hover:from-purple-500 hover:via-pink-500 hover:to-orange-500
                      transform hover:scale-105 transition-all duration-200
                      active:scale-95 block"
            style={{ position: 'relative', zIndex: 9999 }}
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