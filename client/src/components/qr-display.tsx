import QRCode from "react-qr-code";
import { Card } from "@/components/ui/card";
import { Scan } from "lucide-react";

interface QRDisplayProps {
  questionId: number;
}

export function QRDisplay({ questionId }: QRDisplayProps) {
  const currentHost = window.location.host;
  const url = `${window.location.protocol}//${currentHost}/vote/${questionId}`;

  return (
    <Card className="p-6 flex flex-col items-center gap-4 card-hover">
      <div className="flex items-center gap-2">
        <Scan className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-semibold gradient-text">掃描 QR 碼進行投票</h2>
      </div>
      <div className="bg-white p-4 rounded-lg shadow-inner transition-transform hover:scale-105">
        <QRCode value={url} size={200} />
      </div>
      <p className="text-sm text-muted-foreground text-center">
        或訪問: <a href={url} className="underline hover:text-primary transition-colors">{url}</a>
      </p>
    </Card>
  );
}