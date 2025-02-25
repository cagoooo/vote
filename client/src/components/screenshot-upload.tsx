import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Camera, Scissors } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ScreenshotUploadProps {
  onImageSelect: (image: string) => void;
}

export function ScreenshotUpload({ onImageSelect }: ScreenshotUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

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
        toast({
          title: "截圖完成",
          description: "已成功返回投票系統",
          variant: "success",
        });
      }, 100);
    });
  };

  const handleScreenshot = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "monitor",
        },
        audio: false
      });

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
      if (err instanceof Error) {
        toast({
          title: "截圖失敗",
          description: err.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "截圖失敗",
          description: "請稍後再試",
          variant: "destructive",
        });
      }
      focusWindow();
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