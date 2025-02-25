import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Camera, Scissors } from "lucide-react";

interface ScreenshotUploadProps {
  onImageSelect: (image: string) => void;
}

export function ScreenshotUpload({ onImageSelect }: ScreenshotUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setPreview(base64);
      onImageSelect(base64);
    };
    reader.readAsDataURL(file);
  };

  const compressImage = (canvas: HTMLCanvasElement, quality = 0.7): string => {
    const MAX_WIDTH = 1920;
    const scale = MAX_WIDTH / canvas.width;

    // 如果圖片寬度小於最大寬度，不需要縮放
    if (scale >= 1) {
      return canvas.toDataURL('image/jpeg', quality);
    }

    // 創建新的canvas進行縮放
    const scaledCanvas = document.createElement('canvas');
    const scaledWidth = canvas.width * scale;
    const scaledHeight = canvas.height * scale;
    scaledCanvas.width = scaledWidth;
    scaledCanvas.height = scaledHeight;

    const ctx = scaledCanvas.getContext('2d');
    if (!ctx) return canvas.toDataURL('image/jpeg', quality);

    ctx.drawImage(canvas, 0, 0, scaledWidth, scaledHeight);
    return scaledCanvas.toDataURL('image/jpeg', quality);
  };

  const handleScreenshot = async () => {
    try {
      // 直接開啟系統的螢幕截圖選擇器
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "monitor",
        },
        audio: false
      });

      // 等待用戶選擇區域並截圖
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();

      // 創建 canvas 來抓取圖片
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 將視頻幀繪製到 canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // 停止所有視頻軌道
      stream.getTracks().forEach(track => track.stop());

      // 壓縮並轉換圖片
      const base64 = compressImage(canvas);
      setPreview(base64);
      onImageSelect(base64);

      // 將焦點返回到應用程式窗口
      window.focus();

    } catch (err) {
      if (err instanceof Error) {
        alert("無法啟動螢幕截圖功能：" + err.message);
      } else {
        alert("無法啟動螢幕截圖功能，請稍後再試。");
      }
      // 確保即使在出錯的情況下也返回焦點
      window.focus();
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button
            onClick={handleScreenshot}
            className="flex items-center gap-2"
          >
            <Scissors className="h-4 w-4" />
            螢幕截圖
          </Button>
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2"
          >
            <Camera className="h-4 w-4" />
            上傳圖片
          </Button>
          <Input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>

        {preview && (
          <div className="mt-4 relative rounded-lg overflow-hidden border border-border">
            <img
              src={preview}
              alt="預覽圖"
              className="max-w-full h-auto"
            />
          </div>
        )}
      </div>
    </Card>
  );
}