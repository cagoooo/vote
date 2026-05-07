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
    <Card className="p-5 sm:p-6 rounded-3xl border-0 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
        <Scan className="w-3.5 h-3.5" />學生掃描加入
      </div>
      <div className="bg-slate-50 rounded-2xl p-3 grid place-items-center">
        <QRCode value={url} size={200} />
      </div>

      {roomCode && (
        <div className="mt-3.5 rounded-2xl p-3 text-center" style={{ background: "linear-gradient(135deg,#EFF6FF,#FCE7F3)" }}>
          <div className="text-[11px] text-slate-500 mb-1 flex items-center justify-center gap-1">
            <KeyRound className="w-3 h-3" />或前往{" "}
            <a href={joinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline underline-offset-2 decoration-blue-400 hover:decoration-blue-700">
              vote ＋ 房間代碼
            </a>
          </div>
          <button
            type="button"
            onClick={copyCode}
            className="w-full flex items-center justify-center gap-3 py-1.5 rounded-md hover:bg-white/60 transition-colors group"
            title="點擊複製"
          >
            <span className="font-mono text-2xl sm:text-3xl font-extrabold tracking-[0.3em] text-blue-900 select-all">
              {roomCode}
            </span>
            {copied ? (
              <Check className="w-5 h-5 text-emerald-600" />
            ) : (
              <Copy className="w-4 h-4 text-blue-400 group-hover:text-blue-600" />
            )}
          </button>
        </div>
      )}

      <p className="mt-3 text-[11px] text-center text-slate-500">
        💡 學生掃 QR Code 後，他們的投票會即時顯示在右邊
      </p>
    </Card>
  );
}
