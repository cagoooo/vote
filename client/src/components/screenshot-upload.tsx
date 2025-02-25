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

  const handleScreenshot = async () => {
    try {
      // 嘗試開啟系統的螢幕截圖工具
      await navigator.mediaDevices.getUserMedia({ video: true });

      // 使用Windows + Shift + S快捷鍵的提示
      alert("請使用 Windows + Shift + S 進行螢幕截圖，\n截圖後請在此處貼上圖片。");

      // 監聽剪貼板
      document.addEventListener('paste', function handlePaste(e) {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            const blob = items[i].getAsFile();
            if (!blob) continue;

            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = reader.result as string;
              setPreview(base64);
              onImageSelect(base64);
            };
            reader.readAsDataURL(blob);

            // 移除事件監聽器
            document.removeEventListener('paste', handlePaste);
            break;
          }
        }
      });
    } catch (err) {
      alert("無法啟動螢幕截圖功能，請確保已授予攝像頭權限。");
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
          <div className="mt-4 relative rounded-lg overflow-hidden">
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