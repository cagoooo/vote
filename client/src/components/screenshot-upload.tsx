import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Camera, Scissors, Smartphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useConfetti } from "@/hooks/use-confetti";

interface ScreenshotUploadProps {
  onImageSelect: (image: string) => void;
}

export function ScreenshotUpload({ onImageSelect }: ScreenshotUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { triggerConfetti } = useConfetti();

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  const handleUploadSuccess = () => {
    triggerConfetti();
    toast({
      title: "上傳成功",
      description: "圖片已成功上傳",
      variant: "success",
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setPreview(base64);
      onImageSelect(base64);
      handleUploadSuccess();
    };
    reader.readAsDataURL(file);
  };

  const compressImage = (canvas: HTMLCanvasElement, quality = 0.7): string => {
    const MAX_WIDTH = 1920;
    const scale = MAX_WIDTH / canvas.width;

    if (scale >= 1) {
      return canvas.toDataURL('image/jpeg', quality);
    }

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

  const focusWindow = () => {
    requestAnimationFrame(() => {
      window.focus();
      setTimeout(() => {
        window.focus();
        handleUploadSuccess();
      }, 100);
    });
  };

  const handleScreenshot = async (isMobile: boolean) => {
    if (isIOS && isMobile) {
      toast({
        title: "iOS 設備截圖說明",
        description: "請依照以下步驟操作：\n1. 使用 iOS 內建截圖功能 (電源鍵 + 音量上鍵)\n2. 點擊「上傳圖片」按鈕\n3. 從相簿中選擇剛才的截圖",
        variant: "info",
      });
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          frameRate: { ideal: 30 },
          width: { ideal: isMobile ? 1080 : 1920 },
          height: { ideal: isMobile ? 1920 : 1080 },
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getDisplayMedia(constraints);

      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      stream.getTracks().forEach(track => track.stop());

      const base64 = compressImage(canvas);
      setPreview(base64);
      onImageSelect(base64);

      focusWindow();

    } catch (err) {
      toast({
        title: "截圖失敗",
        description: isMobile 
          ? "無法截取手機/平板畫面，請嘗試以下步驟：\n1. 確保已授予螢幕錄製權限\n2. 選擇要分享的畫面\n3. 如果使用iOS裝置，請使用系統截圖功能後再上傳" 
          : "截圖失敗，請確保已授予螢幕錄製權限",
        variant: "destructive",
      });
      focusWindow();
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center gap-4 flex-wrap">
          <Button
            onClick={() => handleScreenshot(false)}
            className="flex items-center gap-2"
          >
            <Scissors className="h-4 w-4" />
            電腦截圖
          </Button>
          <Button
            onClick={() => handleScreenshot(true)}
            className="flex items-center gap-2"
          >
            <Smartphone className="h-4 w-4" />
            手機/平板截圖
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