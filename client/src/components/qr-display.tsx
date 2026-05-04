import QRCode from "react-qr-code";
import { Card } from "@/components/ui/card";
import { Scan, KeyRound, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface QRDisplayProps {
  questionId: string | number;
  roomCode?: string;
}

export function QRDisplay({ questionId, roomCode }: QRDisplayProps) {
  const url = `${window.location.origin}${import.meta.env.BASE_URL}${questionId}`;
  const joinUrl = `${window.location.origin}${import.meta.env.BASE_URL}join`;
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const copyCode = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      toast({ title: "代碼已複製", description: roomCode });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: "複製失敗", description: "請手動長按代碼複製", variant: "destructive" });
    }
  };

  return (
    <Card className="p-6 flex flex-col items-center gap-4 card-hover">
      <div className="flex items-center gap-2">
        <Scan className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-semibold gradient-text">掃描 QR 碼進行投票</h2>
      </div>
      <div className="bg-white p-4 rounded-lg shadow-inner transition-transform hover:scale-105">
        <QRCode value={url} size={200} />
      </div>

      {roomCode && (
        <div className="w-full bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3 space-y-1.5">
          <div className="flex items-center justify-center gap-2 text-xs text-blue-700">
            <KeyRound className="w-3.5 h-3.5" />
            <span>或請學生到 <span className="font-mono">{joinUrl}</span> 輸入代碼</span>
          </div>
          <button
            type="button"
            onClick={copyCode}
            className="w-full flex items-center justify-center gap-3 py-2 rounded-md hover:bg-white/60 transition-colors group"
            title="點擊複製"
          >
            <span className="font-mono text-3xl sm:text-4xl font-bold tracking-[0.3em] text-blue-900 select-all">
              {roomCode}
            </span>
            {copied ? (
              <Check className="w-5 h-5 text-green-600" />
            ) : (
              <Copy className="w-5 h-5 text-blue-400 group-hover:text-blue-600" />
            )}
          </button>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        或<a href={url} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary transition-colors">直接開啟連結</a>
      </p>
    </Card>
  );
}
