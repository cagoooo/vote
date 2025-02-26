import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";
import { SiFacebook, SiX, SiLine } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import type { Question, Vote } from "@shared/schema";

interface ShareButtonProps {
  url?: string;
  question?: Question;
  votes?: Vote[];
}

export function ShareButton({ url = window.location.href, question, votes }: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  // Generate share text with voting results if available
  const getShareText = () => {
    if (!question || !votes) return "";

    const totalVotes = votes.length;
    const voteCounts = votes.reduce((acc, vote) => {
      acc[vote.optionIndex] = (acc[vote.optionIndex] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    let shareText = `即時投票系統 - 投票結果\n\n`;
    question.options.forEach((option, index) => {
      const count = voteCounts[index] || 0;
      const percentage = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
      shareText += `📊 ${option}: ${count}票 (${percentage}%)\n`;
    });
    shareText += `\n📈 總投票數：${totalVotes}票\n\n`;
    shareText += `👉 參與投票：${url}`;

    return shareText;
  };

  const shareButtons = [
    {
      name: "Facebook",
      icon: SiFacebook,
      color: "bg-[#1877F2]",
      shareUrl: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(getShareText())}`,
    },
    {
      name: "X (Twitter)",
      icon: SiX,
      color: "bg-[#000000]",
      shareUrl: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(getShareText())}`,
    },
    {
      name: "LINE",
      icon: SiLine,
      color: "bg-[#00B900]",
      shareUrl: `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(getShareText())}`,
    },
  ];

  const handleShare = (shareUrl: string, platform: string) => {
    window.open(shareUrl, "_blank", "noopener,noreferrer");
    setIsOpen(false);
    toast({
      title: `分享到 ${platform}`,
      description: "已開啟分享視窗",
    });
  };

  const handleCopyLink = async () => {
    try {
      const shareText = getShareText();
      if (!shareText) {
        toast({
          title: "複製失敗",
          description: "無法獲取投票結果",
          variant: "destructive",
        });
        return;
      }

      await navigator.clipboard.writeText(shareText);
      toast({
        title: "複製成功",
        description: "投票結果已複製到剪貼簿",
      });
      setIsOpen(false);
    } catch (err) {
      console.error('Copy failed:', err);
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
        className="rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="分享投票結果"
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
            className="absolute top-full mt-2 right-0 flex gap-2 z-50"
          >
            {shareButtons.map((button) => (
              <motion.button
                key={button.name}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleShare(button.shareUrl, button.name)}
                className={`p-2 rounded-full text-white ${button.color} hover:opacity-90 transition-opacity shadow-lg hover:shadow-xl`}
                aria-label={`分享到 ${button.name}`}
              >
                <button.icon className="h-5 w-5" />
              </motion.button>
            ))}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleCopyLink}
              className="p-2 rounded-full text-white bg-primary hover:opacity-90 transition-opacity shadow-lg hover:shadow-xl"
              aria-label="複製分享連結"
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