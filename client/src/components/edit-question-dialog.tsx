import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScreenshotUpload } from "@/components/screenshot-upload";
import { useToast } from "@/hooks/use-toast";
import * as firestore from "@/lib/firestore-voting";
import { compressImageToFit } from "@/lib/image-compress";
import { uploadImageIfLarge, deleteImageFromUrl } from "@/lib/image-storage";
import { Plus, Minus, Save, Circle, CheckSquare, AlertTriangle, Image as ImageIcon, Loader2, RefreshCw } from "lucide-react";

interface Props {
    question: firestore.FirestoreQuestion | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSaved?: (updated: firestore.FirestoreQuestion) => void;
}

export function EditQuestionDialog({ question, open, onOpenChange, onSaved }: Props) {
    const { toast } = useToast();
    const qc = useQueryClient();

    const [imageUrl, setImageUrl] = useState("");
    const [options, setOptions] = useState<string[]>([]);
    const [questionType, setQuestionType] = useState<firestore.QuestionType>("single");
    const [requireIdentity, setRequireIdentity] = useState(false);
    const [showImagePicker, setShowImagePicker] = useState(false);
    const [imageProcessing, setImageProcessing] = useState(false);
    const [originalOptionCount, setOriginalOptionCount] = useState(0);
    const [originalImageUrl, setOriginalImageUrl] = useState("");

    // 從 question prop 帶入初始值
    useEffect(() => {
        if (!question || !open) return;
        setImageUrl(question.imageUrl || "");
        setOptions([...(question.options || [])]);
        setQuestionType(question.questionType ?? "single");
        setRequireIdentity(!!question.requireIdentity);
        setShowImagePicker(false);
        setOriginalOptionCount(question.options?.length ?? 0);
        setOriginalImageUrl(question.imageUrl || "");
    }, [question, open]);

    const handleNewImage = async (raw: string) => {
        setImageProcessing(true);
        try {
            const compressed = await compressImageToFit(raw);
            const finalUrl = await uploadImageIfLarge(compressed.dataUrl);
            setImageUrl(finalUrl);
            setShowImagePicker(false);
            if (compressed.didCompress) {
                toast({
                    title: "圖片已壓縮",
                    description: `${(compressed.originalBytes / 1024).toFixed(0)} KB → ${(compressed.finalBytes / 1024).toFixed(0)} KB`,
                });
            }
        } catch (err: any) {
            toast({ title: "圖片處理失敗", description: err?.message ?? "請再試一次", variant: "destructive" });
        } finally {
            setImageProcessing(false);
        }
    };

    const save = useMutation({
        mutationFn: async () => {
            if (!question) throw new Error("沒有題目可編輯");
            const trimmed = options.map((s) => s.trim()).filter(Boolean);
            if (trimmed.length < 2) throw new Error("至少要 2 個選項");

            const patch: firestore.UpdateQuestionPatch = {
                imageUrl,
                options: trimmed,
                questionType,
                requireIdentity,
            };
            // 選項數量改了 → 清掉舊正解（避免指向不存在的選項）
            if (trimmed.length !== originalOptionCount) {
                patch.correctAnswer = null;
                patch.correctAnswers = null;
            }
            // 題型改了 → 清掉對應的另一種正解
            if (questionType !== (question.questionType ?? "single")) {
                if (questionType === "multiple") patch.correctAnswer = null;
                else patch.correctAnswers = null;
            }
            await firestore.updateQuestion(question.id, patch);

            // 圖片有換 → 清掉舊 Storage 檔（base64 inline 自動 no-op）
            if (originalImageUrl && originalImageUrl !== imageUrl) {
                deleteImageFromUrl(originalImageUrl).catch(() => {});
            }

            return { ...question, ...patch } as firestore.FirestoreQuestion;
        },
        onSuccess: (updated) => {
            toast({ title: "已儲存", description: "題目更新完成", variant: "success" });
            qc.invalidateQueries({ queryKey: ["my-questions"] });
            onSaved?.(updated);
            onOpenChange(false);
        },
        onError: (err: Error) => {
            toast({ title: "儲存失敗", description: err.message, variant: "destructive" });
        },
    });

    if (!question) return null;

    const optionsChangedCount = options.filter((s) => s.trim()).length !== originalOptionCount;
    const typeChanged = questionType !== (question.questionType ?? "single");
    const willClearCorrect = (optionsChangedCount || typeChanged) && (question.correctAnswer !== null || (Array.isArray(question.correctAnswers) && question.correctAnswers.length > 0));

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>編輯題目</DialogTitle>
                    <DialogDescription>
                        房間代碼 <span className="font-mono font-bold text-blue-600">{question.roomCode}</span> · 修改後立即生效，已投的票不會重算
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-2">
                    {/* 圖片 */}
                    <div>
                        <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                            <ImageIcon className="w-4 h-4" />題目圖片
                        </label>
                        {showImagePicker ? (
                            <div className="space-y-2">
                                <ScreenshotUpload onImageSelect={handleNewImage} />
                                <Button type="button" variant="ghost" size="sm" onClick={() => setShowImagePicker(false)}>
                                    取消換圖
                                </Button>
                            </div>
                        ) : (
                            <div className="flex items-start gap-3">
                                {imageUrl ? (
                                    <img src={imageUrl} alt="目前題目圖" className="w-32 h-24 object-contain bg-slate-50 rounded border" />
                                ) : (
                                    <div className="w-32 h-24 bg-slate-50 rounded border flex items-center justify-center text-xs text-slate-400">無圖</div>
                                )}
                                <Button type="button" variant="outline" size="sm" onClick={() => setShowImagePicker(true)} disabled={imageProcessing} className="gap-1">
                                    {imageProcessing ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />處理中…</> : <><RefreshCw className="w-3.5 h-3.5" />換圖</>}
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* 題型 */}
                    <div>
                        <label className="text-sm font-semibold text-gray-700 mb-2 block">題型</label>
                        <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
                            <button
                                type="button"
                                onClick={() => setQuestionType("single")}
                                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${questionType === "single" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}
                            >
                                <Circle className="w-4 h-4" />單選
                            </button>
                            <button
                                type="button"
                                onClick={() => setQuestionType("multiple")}
                                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${questionType === "multiple" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}
                            >
                                <CheckSquare className="w-4 h-4" />多選
                            </button>
                        </div>
                    </div>

                    {/* 選項 */}
                    <div>
                        <label className="text-sm font-semibold text-gray-700 mb-2 block">選項</label>
                        <div className="space-y-2">
                            {options.map((opt, i) => (
                                <div key={i} className="flex gap-2">
                                    <Input
                                        value={opt}
                                        onChange={(e) => {
                                            const next = [...options];
                                            next[i] = e.target.value;
                                            setOptions(next);
                                        }}
                                        placeholder={`選項 ${i + 1}`}
                                    />
                                    {options.length > 2 && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setOptions(options.filter((_, idx) => idx !== i))}
                                            className="hover:bg-red-50 hover:border-red-200 flex-shrink-0"
                                        >
                                            <Minus className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setOptions([...options, ""])}
                            className="mt-2 gap-1"
                        >
                            <Plus className="w-3.5 h-3.5" />新增選項
                        </Button>
                    </div>

                    {/* 具名 */}
                    <label className="flex items-center gap-3 p-3 rounded-lg border border-blue-200 bg-blue-50/40 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={requireIdentity}
                            onChange={(e) => setRequireIdentity(e.target.checked)}
                            className="w-4 h-4 accent-blue-600"
                        />
                        <span className="text-sm text-blue-900">需要學生具名才能投票</span>
                    </label>

                    {/* 警告 */}
                    {willClearCorrect && (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <div>選項數量或題型有變動，原本設定的<strong>正確答案會被清除</strong>，儲存後請重設。</div>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={save.isPending}>
                        取消
                    </Button>
                    <Button
                        type="button"
                        onClick={() => save.mutate()}
                        disabled={save.isPending || imageProcessing || options.filter((s) => s.trim()).length < 2}
                        className="gap-1.5"
                    >
                        {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        儲存變更
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
