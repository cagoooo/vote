import QRCode from "react-qr-code";
import { Card } from "@/components/ui/card";

interface QRDisplayProps {
  questionId: number;
}

export function QRDisplay({ questionId }: QRDisplayProps) {
  // 使用當前網頁的主機名稱，確保在任何環境下都能正常工作
  const currentHost = window.location.host;
  const url = `${window.location.protocol}//${currentHost}/vote/${questionId}`;

  return (
    <Card className="p-6 flex flex-col items-center gap-4">
      <h2 className="text-lg font-semibold">掃描 QR 碼進行投票</h2>
      <div className="bg-white p-4 rounded-lg">
        <QRCode value={url} size={200} />
      </div>
      <p className="text-sm text-muted-foreground">
        或訪問: <a href={url} className="underline">{url}</a>
      </p>
    </Card>
  );
}