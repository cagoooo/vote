import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScreenshotUpload } from "@/components/screenshot-upload";
import { QRDisplay } from "@/components/qr-display";
import { VotingStats } from "@/components/voting-stats";
import { ShareButton } from "@/components/share-button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useVotingSound } from "@/hooks/use-voting-sounds";
import type { Question, Vote } from "@shared/schema"; // Assuming Vote type exists
import { Plus, Minus, Sparkles, RefreshCw, CheckCircle2, Eye, EyeOff } from "lucide-react";

export default function Teacher() {
  const [imageUrl, setImageUrl] = useState("");
  const [options, setOptions] = useState<string[]>(["", "", ""]);
  const [createdQuestion, setCreatedQuestion] = useState<Question | null>(null);
  const [votes, setVotes] = useState<Vote[]>([]); // Added votes state
  const { toast } = useToast();
  const { playVoteSessionStart, playVoteSubmitted } = useVotingSound();

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
      playVoteSessionStart();
      toast({
        title: "成功建立問題",
        description: "學生現在可以開始投票了",
        variant: "success",
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

  const setCorrectAnswer = useMutation({
    mutationFn: async (correctAnswer: number) => {
      if (!createdQuestion) throw new Error("No question created");
      const res = await apiRequest("POST", `/api/questions/${createdQuestion.id}/correct-answer`, {
        correctAnswer,
      });
      return res.json();
    },
    onSuccess: (question) => {
      setCreatedQuestion(question);
      toast({
        title: "正確答案已設定",
        description: `選項 ${question.correctAnswer! + 1} 已設為正確答案`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "設定失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleShowAnswer = useMutation({
    mutationFn: async (show: boolean) => {
      if (!createdQuestion) throw new Error("No question created");
      const res = await apiRequest("POST", `/api/questions/${createdQuestion.id}/show-answer`, {
        show,
      });
      return res.json();
    },
    onSuccess: (question) => {
      setCreatedQuestion(question);
      toast({
        title: question.showAnswer ? "正確答案已顯示" : "正確答案已隱藏",
        description: question.showAnswer 
          ? "學生現在可以看到正確答案" 
          : "正確答案已從投票結果中隱藏",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "操作失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetVotes = useMutation({
    mutationFn: async () => {
      if (!createdQuestion) throw new Error("No question created");
      const res = await apiRequest("POST", `/api/questions/${createdQuestion.id}/reset-votes`, {});
      return res.json();
    },
    onSuccess: () => {
      setVotes([]);
      toast({
        title: "投票已重置",
        description: "所有投票記錄已清除",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "重置失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetAll = () => {
    setImageUrl("");
    setOptions(["", "", ""]);
    setCreatedQuestion(null);
    setVotes([]); // Reset votes
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

  const handleVoteReceived = (newVotes: Vote[]) => { //updated handleVoteReceived
    playVoteSubmitted();
    setVotes(newVotes); // Update votes state
  };

  const validOptionCount = options.filter(Boolean).length;
  const canSubmit = imageUrl && validOptionCount >= 2;

  return (
    <div className="page-container max-w-4xl">
      <div className="flex items-center justify-center gap-2 sm:gap-3 md:gap-4 mb-6 md:mb-8 transition-all duration-300">
        <a href="https://akai.smes.tyc.edu.tw/" target="_blank" rel="noopener noreferrer"
           className="relative group p-2 rounded-lg transition-all duration-300 hover:bg-yellow-100/10">
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/20 to-amber-500/20 rounded-lg blur opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
          <img
            src="/logo.png"
            alt="Logo"
            className="h-10 sm:h-12 md:h-16 lg:h-20 w-auto object-contain relative transition-all duration-300 
              group-hover:scale-110 group-hover:rotate-3 group-hover:brightness-110 
              group-hover:shadow-[0_0_30px_rgba(251,191,36,0.3)] 
              group-active:scale-95 group-active:rotate-0"
          />
        </a>
        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold gradient-text transition-all duration-300">
          即時投票系統
        </h1>
      </div>

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
                    className="transition-all duration-300 focus:ring-2 focus:ring-green-500/20 border-green-100 hover:border-green-200 focus:border-green-300 focus:outline-none bg-green-50/30"
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
                className="flex items-center gap-2 hover:bg-green-500/10 hover:border-green-200 transition-colors"
              >
                <Plus className="h-4 w-4" />
                添加選項
              </Button>
            </div>
          </Card>

          <Button
            type="submit"
            className="w-full h-12 text-lg shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-r from-primary via-red-500 to-purple-600 hover:scale-[1.02] ripple"
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold gradient-text">投票進行中</h2>
            <ShareButton
              url={window.location.href}
              question={createdQuestion}
              votes={votes} // Added votes prop
            />
          </div>

          <Card className="p-6 card-hover">
            <div className="flex justify-center mb-6">
              <img
                src={createdQuestion.imageUrl}
                alt="問題圖片"
                className="max-w-full max-h-[40vh] w-auto h-auto object-contain rounded-lg shadow-lg"
              />
            </div>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <QRDisplay questionId={createdQuestion.id} />
            <VotingStats question={createdQuestion} onVoteReceived={handleVoteReceived} />
          </div>

          {/* Correct Answer Management */}
          <Card className="p-4 sm:p-6 card-hover shadow-lg border-0 bg-gradient-to-r from-green-50 to-blue-50">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-green-100 rounded-full">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-800">
                正確答案管理
              </h3>
            </div>
            
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-medium text-gray-700">
                    設定正確答案選項：
                  </p>
                  {createdQuestion.correctAnswer !== null && (
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                      已設定
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {createdQuestion.options.map((option, index) => (
                    <Button
                      key={index}
                      variant={createdQuestion.correctAnswer === index ? "default" : "outline"}
                      size="default"
                      onClick={() => setCorrectAnswer.mutate(index)}
                      disabled={setCorrectAnswer.isPending}
                      className={`h-auto min-h-[3rem] p-3 text-left text-sm font-medium transition-all duration-200 ${
                        createdQuestion.correctAnswer === index 
                          ? "bg-green-500 hover:bg-green-600 text-white shadow-lg transform hover:scale-105" 
                          : "hover:bg-green-50 hover:border-green-300 hover:shadow-md active:scale-95"
                      }`}
                    >
                      <div className="w-full">
                        <div className="font-bold text-xs mb-1">選項 {index + 1}</div>
                        <div className="text-xs leading-tight break-words">
                          {option.length > 30 ? `${option.substring(0, 30)}...` : option}
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-semibold text-gray-800">
                        答案顯示狀態
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        createdQuestion.showAnswer 
                          ? "bg-green-100 text-green-700" 
                          : "bg-gray-100 text-gray-600"
                      }`}>
                        {createdQuestion.showAnswer ? "已公開" : "已隱藏"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      {createdQuestion.showAnswer 
                        ? "學生現在可以在投票結果中看到正確答案標記" 
                        : "正確答案僅對老師可見，學生無法看到"}
                    </p>
                  </div>
                  <Button
                    onClick={() => toggleShowAnswer.mutate(!createdQuestion.showAnswer)}
                    disabled={toggleShowAnswer.isPending || createdQuestion.correctAnswer === null}
                    variant={createdQuestion.showAnswer ? "destructive" : "default"}
                    size="default"
                    className={`flex items-center gap-2 min-w-[120px] h-10 font-medium transition-all duration-200 ${
                      createdQuestion.showAnswer 
                        ? "hover:shadow-lg" 
                        : "bg-blue-500 hover:bg-blue-600 hover:shadow-lg"
                    }`}
                  >
                    {createdQuestion.showAnswer ? (
                      <>
                        <EyeOff className="w-4 h-4" />
                        隱藏答案
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4" />
                        顯示答案
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {createdQuestion.correctAnswer !== null && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-300 rounded-lg p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="p-1 bg-green-100 rounded-full flex-shrink-0 mt-0.5">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-green-800 mb-1">
                        目前正確答案
                      </h4>
                      <div className="bg-white rounded-md p-3 border border-green-200">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded">
                            選項 {createdQuestion.correctAnswer + 1}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed break-words">
                          {createdQuestion.options[createdQuestion.correctAnswer]}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Additional Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Button
              onClick={() => resetVotes.mutate()}
              disabled={resetVotes.isPending}
              variant="outline"
              className="flex items-center justify-center gap-2 h-12 sm:h-14 font-medium transition-all duration-200 hover:bg-orange-50 hover:border-orange-300 text-orange-600 hover:shadow-md active:scale-95 border-2"
            >
              <RefreshCw className={`w-5 h-5 ${resetVotes.isPending ? 'animate-spin' : ''}`} />
              <span className="text-sm sm:text-base">重置投票</span>
            </Button>
            <Button
              onClick={resetAll}
              className="flex items-center justify-center gap-2 h-12 sm:h-14 font-medium transition-all duration-200 bg-red-50 hover:bg-red-100 text-red-600 hover:shadow-md active:scale-95 border-2 border-red-200 hover:border-red-300"
              variant="ghost"
            >
              <RefreshCw className="w-5 h-5" />
              <span className="text-sm sm:text-base">重新建立投票</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}