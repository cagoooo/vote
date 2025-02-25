import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScreenshotUpload } from "@/components/screenshot-upload";
import { QRDisplay } from "@/components/qr-display";
import { VotingStats } from "@/components/voting-stats";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Question } from "@shared/schema";
import { Plus, Minus, Sparkles, RefreshCw } from "lucide-react";

export default function Teacher() {
  const [imageUrl, setImageUrl] = useState("");
  const [options, setOptions] = useState<string[]>(["", "", ""]);
  const [createdQuestion, setCreatedQuestion] = useState<Question | null>(null);
  const { toast } = useToast();

  const createQuestion = useMutation({
    mutationFn: async () => {
      const filteredOptions = options.filter(Boolean);
      const res = await apiRequest("POST", "/api/questions", {
        imageUrl,
        options: filteredOptions,
      });
      return res.json();
    },
    onSuccess: (question) => {
      setCreatedQuestion(question);
      toast({
        title: "成功建立問題",
        description: "學生現在可以開始投票了",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "建立問題失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetAll = () => {
    setImageUrl("");
    setOptions(["", "", ""]);
    setCreatedQuestion(null);
    toast({
      title: "已重置所有設定",
      description: "您可以重新開始建立新的投票",
    });
  };

  const addOption = () => setOptions([...options, ""]);
  const removeOption = (index: number) => {
    const newOptions = [...options];
    newOptions.splice(index, 1);
    setOptions(newOptions);
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validOptions = options.filter(Boolean);

    if (!imageUrl) {
      toast({
        title: "缺少圖片",
        description: "請先上傳或截取圖片",
        variant: "destructive",
      });
      return;
    }

    if (validOptions.length < 2) {
      toast({
        title: "選項不足",
        description: "請至少填寫兩個選項",
        variant: "destructive",
      });
      return;
    }

    await createQuestion.mutateAsync();
  };

  const handleImageSelect = (image: string) => {
    setImageUrl(image);
  };

  const validOptionCount = options.filter(Boolean).length;
  const canSubmit = imageUrl && validOptionCount >= 2;

  return (
    <div className="page-container max-w-4xl">
      <h1 className="text-4xl font-bold mb-8 gradient-text text-center">
        石門國小即時投票系統
      </h1>

      {!createdQuestion ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          <ScreenshotUpload onImageSelect={handleImageSelect} />

          <Card className="p-6 card-hover">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              選項設置
            </h2>
            <div className="space-y-4 animate-fade-in">
              {options.map((option, index) => (
                <div key={index} className="flex gap-2 animate-slide-up" style={{ animationDelay: `${index * 100}ms` }}>
                  <Input
                    value={option}
                    onChange={(e) => updateOption(index, e.target.value)}
                    placeholder={`選項 ${index + 1}`}
                    className="transition-all duration-300 focus:ring-2 focus:ring-red-500/20 border-red-100 hover:border-red-200 focus:border-red-300"
                  />
                  {options.length > 2 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeOption(index)}
                      className="hover:bg-red-500/10 hover:border-red-200 transition-colors"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={addOption}
                className="flex items-center gap-2 hover:bg-red-500/10 hover:border-red-200 transition-colors"
              >
                <Plus className="h-4 w-4" />
                添加選項
              </Button>
            </div>
          </Card>

          <Button
            type="submit"
            className="w-full h-12 text-lg shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-r from-primary via-red-500 to-purple-600 hover:scale-[1.02]"
            disabled={createQuestion.isPending || !canSubmit}
          >
            {createQuestion.isPending ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                建立中...
              </div>
            ) : (
              "建立問題"
            )}
          </Button>

          {!imageUrl && (
            <p className="text-sm text-muted-foreground text-center animate-fade-in">
              請先上傳或截取圖片
            </p>
          )}
          {validOptionCount < 2 && (
            <p className="text-sm text-muted-foreground text-center animate-fade-in">
              請至少填寫兩個選項（目前已填寫 {validOptionCount} 個）
            </p>
          )}
        </form>
      ) : (
        <div className="space-y-6 animate-fade-in">
          <div className="grid md:grid-cols-2 gap-6">
            <QRDisplay questionId={createdQuestion.id} />
            <VotingStats question={createdQuestion} />
          </div>

          <Button
            onClick={resetAll}
            className="w-full flex items-center justify-center gap-2 h-12 text-lg bg-red-500/10 hover:bg-red-500/20 text-red-600"
            variant="ghost"
          >
            <RefreshCw className="w-5 h-5" />
            重新建立投票
          </Button>
        </div>
      )}
    </div>
  );
}