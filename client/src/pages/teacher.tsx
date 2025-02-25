import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScreenshotUpload } from "@/components/screenshot-upload";
import { QRDisplay } from "@/components/qr-display";
import { VotingStats } from "@/components/voting-stats";
import { apiRequest } from "@/lib/queryClient";
import type { Question } from "@shared/schema";
import { Plus, Minus } from "lucide-react";

export default function Teacher() {
  const [imageUrl, setImageUrl] = useState("");
  const [options, setOptions] = useState<string[]>(["", "", "", ""]);
  const [createdQuestion, setCreatedQuestion] = useState<Question | null>(null);

  const createQuestion = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/questions", {
        imageUrl,
        options: options.filter(Boolean),
      });
      return res.json();
    },
  });

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
    const question = await createQuestion.mutateAsync();
    setCreatedQuestion(question);
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">建立投票問題</h1>

      {!createdQuestion ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          <ScreenshotUpload onImageSelect={setImageUrl} />

          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">選項設置</h2>
            <div className="space-y-4">
              {options.map((option, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={option}
                    onChange={(e) => updateOption(index, e.target.value)}
                    placeholder={`選項 ${index + 1}`}
                  />
                  {options.length > 2 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeOption(index)}
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
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                添加選項
              </Button>
            </div>
          </Card>

          <Button
            type="submit"
            className="w-full"
            disabled={!imageUrl || options.filter(Boolean).length < 2}
          >
            建立問題
          </Button>
        </form>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          <QRDisplay questionId={createdQuestion.id} />
          <VotingStats question={createdQuestion} />
        </div>
      )}
    </div>
  );
}