import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";
import { SiFacebook, SiX, SiLine } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";

interface ShareButtonProps {
  url?: string;
}

export function ShareButton({ url = window.location.href }: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const shareButtons = [
    {
      name: "Facebook",
      icon: SiFacebook,
      color: "bg-[#1877F2]",
      shareUrl: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    },
    {
      name: "X (Twitter)",
      icon: SiX,
      color: "bg-[#000000]",
      shareUrl: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}`,
    },
    {
      name: "LINE",
      icon: SiLine,
      color: "bg-[#00B900]",
      shareUrl: `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}`,
    },
  ];

  const handleShare = (shareUrl: string) => {
    window.open(shareUrl, "_blank", "noopener,noreferrer");
    setIsOpen(false);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "複製成功",
        description: "連結已複製到剪貼簿",
      });
      setIsOpen(false);
    } catch (err) {
      toast({
        title: "複製失敗",
        description: "請手動複製連結",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="icon"
        className="rounded-full"
        onClick={() => setIsOpen(!isOpen)}
      >
        <motion.div
          animate={{ rotate: isOpen ? 90 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <Share2 className="h-4 w-4" />
        </motion.div>
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full mt-2 right-0 flex gap-2"
          >
            {shareButtons.map((button) => (
              <motion.button
                key={button.name}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleShare(button.shareUrl)}
                className={`p-2 rounded-full text-white ${button.color} hover:opacity-90 transition-opacity`}
              >
                <button.icon className="h-5 w-5" />
              </motion.button>
            ))}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleCopyLink}
              className="p-2 rounded-full text-white bg-gray-600 hover:opacity-90 transition-opacity"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}