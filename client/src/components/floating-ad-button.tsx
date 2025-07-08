import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FloatingAdButton() {
  const [isVisible, setIsVisible] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  if (!isVisible) return null;

  const handleClick = () => {
    window.open("https://document-ai-companion-ipad4.replit.app", "_blank");
  };

  const handleClose = (e: React.MouseEvent) => {
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
          className="fixed bottom-6 right-6 z-50 group"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* 關閉按鈕 */}
          <motion.button
            onClick={handleClose}
            className="absolute -top-2 -right-2 w-6 h-6 bg-gray-800 text-white rounded-full 
                     flex items-center justify-center text-xs hover:bg-gray-700 transition-colors z-10
                     shadow-lg border border-gray-600"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <X size={12} />
          </motion.button>

          {/* 主按鈕 */}
          <motion.div
            onClick={handleClick}
            className="relative cursor-pointer"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {/* 背景光暈效果 */}
            <motion.div
              className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 blur-lg opacity-75"
              animate={{
                scale: isHovered ? 1.1 : 1,
                opacity: isHovered ? 0.9 : 0.6,
              }}
              transition={{ duration: 0.3 }}
            />

            {/* 按鈕本體 */}
            <div className="relative bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 
                          rounded-2xl p-4 md:p-6 shadow-2xl border border-white/20 backdrop-blur-sm
                          min-w-[200px] md:min-w-[250px] text-center">
              
              {/* 閃爍效果 */}
              <motion.div
                className="absolute top-2 right-2"
                animate={{
                  rotate: [0, 360],
                  scale: [1, 1.2, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <Sparkles className="text-yellow-300 w-4 h-4 md:w-5 md:h-5" />
              </motion.div>

              {/* 文字內容 */}
              <div className="text-white">
                <div className="text-lg md:text-xl font-bold mb-1 tracking-wide">
                  創建專屬助手
                </div>
                <div className="text-2xl md:text-3xl mb-2">🦄</div>
                <div className="text-xs md:text-sm opacity-90 font-medium">
                  點擊開始使用
                </div>
              </div>

              {/* 底部裝飾線 */}
              <motion.div
                className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 to-pink-400 rounded-b-2xl"
                animate={{
                  opacity: [0.7, 1, 0.7],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            </div>
          </motion.div>

          {/* 脈動效果圈 */}
          <motion.div
            className="absolute inset-0 rounded-2xl border-2 border-white/30"
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.5, 0.8, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}