import QRCode from "react-qr-code";
import { Card } from "@/components/ui/card";

interface QRDisplayProps {
  questionId: number;
}

export function QRDisplay({ questionId }: QRDisplayProps) {
  const domains = (import.meta.env.VITE_REPLIT_DOMAINS || "").split(",")[0];
  const url = `https://${domains}/vote/${questionId}`;

  return (
    <Card className="p-6 flex flex-col items-center gap-4">
      <h2 className="text-lg font-semibold">Scan to Vote</h2>
      <div className="bg-white p-4 rounded-lg">
        <QRCode value={url} size={200} />
      </div>
      <p className="text-sm text-muted-foreground">
        Or visit: <a href={url} className="underline">{url}</a>
      </p>
    </Card>
  );
}
