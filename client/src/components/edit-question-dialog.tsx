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
import {
    Plus, X as XIcon, Save, Circle, CheckSquare, AlertTriangle,
    Image as ImageIcon, Loader2, RefreshCw, Pencil, UserCheck,
} from "lucide-react";

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
            if (trimmed.length !== originalOptionCount) {
                patch.correctAnswer = null;
                patch.correctAnswers = null;
            }
            if (questionType !== (question.questionType ?? "single")) {
                if (questionType === "multiple") patch.correctAnswer = null;
                else patch.correctAnswers = null;
            }
            await firestore.updateQuestion(question.id, patch);

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

    const validOptionCount = options.filter((s) => s.trim()).length;
    const optionsChangedCount = validOptionCount !== originalOptionCount;
    const typeChanged = questionType !== (question.questionType ?? "single");
    const willClearCorrect = (optionsChangedCount || typeChanged) && (question.correctAnswer !== null || (Array.isArray(question.correctAnswers) && question.correctAnswers.length > 0));

    const OptionIcon = questionType === "single" ? Circle : CheckSquare;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white p-0 gap-0 border-slate-200">
                {/* Header */}
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 bg-gradient-to-br from-blue-50/60 to-white space-y-1.5">
                    <DialogTitle className="flex items-center gap-2 text-slate-900">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 text-blue-600">
                            <Pencil className="w-4 h-4" />
                        </span>
                        編輯題目
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500 pl-10">
                        房間代碼{" "}
                        <span className="inline-block px-1.5 py-0.5 rounded font-mono font-bold text-blue-700 bg-blue-100/70 text-[11px] tracking-wider">
                            {question.roomCode}
                        </span>{" "}
                        · 修改後立即生效，已投的票不會重算
                    </DialogDescription>
                </DialogHeader>

                <div className="px-6 py-5 space-y-5 bg-white">
                    {/* 圖片 */}
                    <section>
                        <div className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                            <ImageIcon className="w-4 h-4 text-slate-500" />題目圖片
                        </div>
                        {showImagePicker ? (
                            <div className="space-y-2 p-3 rounded-lg border border-dashed border-blue-200 bg-blue-50/30">
                                <ScreenshotUpload onImageSelect={handleNewImage} />
                                <Button type="button" variant="ghost" size="sm" onClick={() => setShowImagePicker(false)}>
                                    取消換圖
                                </Button>
                            </div>
                        ) : (
                            <div className="flex items-start gap-3">
                                <div className="relative group">
                                    {imageUrl ? (
                                        <img
                                            src={imageUrl}
                                            alt="目前題目圖"
                                            className="w-44 h-32 object-contain bg-slate-50 rounded-lg border border-slate-200 shadow-sm"
                                        />
                                    ) : (
                                        <div className="w-44 h-32 bg-slate-50 rounded-lg border border-dashed border-slate-300 flex flex-col items-center justify-center text-xs text-slate-400 gap-1">
                                            <ImageIcon className="w-6 h-6 opacity-40" />
                                            尚未設定圖片
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col gap-1.5 pt-1">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setShowImagePicker(true)}
                                        disabled={imageProcessing}
                                        className="gap-1.5 border-slate-300"
                                    >
                                        {imageProcessing ? (
                                            <><Loader2 className="w-3.5 h-3.5 animate-spin" />處理中…</>
                                        ) : (
                                            <><RefreshCw className="w-3.5 h-3.5" />{imageUrl ? "換圖" : "上傳"}</>
                                        )}
                                    </Button>
                                    <span className="text-[11px] text-slate-400 leading-snug">
                                        建議 16:9
                                        <br />已上傳會自動壓縮
                                    </span>
                                </div>
                            </div>
                        )}
                    </section>

                    {/* 題型 */}
                    <section>
                        <div className="text-sm font-semibold text-slate-700 mb-2">題型</div>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setQuestionType("single")}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border-2 text-left transition-all ${
                                    questionType === "single"
                                        ? "border-blue-500 bg-blue-50 shadow-sm"
                                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                                }`}
                            >
                                <Circle className={`w-5 h-5 flex-shrink-0 ${questionType === "single" ? "text-blue-600" : "text-slate-400"}`} />
                                <div className="min-w-0">
                                    <div className={`text-sm font-medium ${questionType === "single" ? "text-blue-900" : "text-slate-700"}`}>單選</div>
                                    <div className="text-[11px] text-slate-500 leading-tight">只能選 1 個</div>
                                </div>
                            </button>
                            <button
                                type="button"
                                onClick={() => setQuestionType("multiple")}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border-2 text-left transition-all ${
                                    questionType === "multiple"
                                        ? "border-blue-500 bg-blue-50 shadow-sm"
                                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                                }`}
                            >
                                <CheckSquare className={`w-5 h-5 flex-shrink-0 ${questionType === "multiple" ? "text-blue-600" : "text-slate-400"}`} />
                                <div className="min-w-0">
                                    <div className={`text-sm font-medium ${questionType === "multiple" ? "text-blue-900" : "text-slate-700"}`}>多選</div>
                                    <div className="text-[11px] text-slate-500 leading-tight">可複選多個</div>
                                </div>
                            </button>
                        </div>
                    </section>

                    {/* 選項 */}
                    <section>
                        <div className="flex items-baseline justify-between mb-2">
                            <div className="text-sm font-semibold text-slate-700">選項</div>
                            <div className="text-[11px] text-slate-400">{validOptionCount} 個有效 · 至少 2 個</div>
                        </div>
                        <div className="space-y-1.5">
                            {options.map((opt, i) => (
                                <div key={i} className="group flex items-center gap-2">
                                    <div className="flex-shrink-0 w-7 h-9 flex items-center justify-center rounded-md bg-slate-100 text-slate-500">
                                        <OptionIcon className="w-4 h-4" />
                                    </div>
                                    <Input
                                        value={opt}
                                        onChange={(e) => {
                                            const next = [...options];
                                            next[i] = e.target.value;
                                            setOptions(next);
                                        }}
                                        placeholder={`選項 ${i + 1}`}
                                        className="bg-white"
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setOptions(options.filter((_, idx) => idx !== i))}
                                        disabled={options.length <= 2}
                                        className="flex-shrink-0 w-8 h-8 text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30"
                                        title={options.length <= 2 ? "至少要保留 2 個選項" : "刪除此選項"}
                                    >
                                        <XIcon className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setOptions([...options, ""])}
                            className="mt-2 gap-1 border-dashed border-slate-300 text-slate-600 hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50"
                        >
                            <Plus className="w-3.5 h-3.5" />新增選項
                        </Button>
                    </section>

                    {/* 具名 toggle */}
                    <section>
                        <label
                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                requireIdentity
                                    ? "border-blue-300 bg-blue-50"
                                    : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                            }`}
                        >
                            <input
                                type="checkbox"
                                checked={requireIdentity}
                                onChange={(e) => setRequireIdentity(e.target.checked)}
                                className="w-4 h-4 accent-blue-600"
                            />
                            <UserCheck className={`w-4 h-4 ${requireIdentity ? "text-blue-600" : "text-slate-400"}`} />
                            <div className="flex-1 min-w-0">
                                <div className={`text-sm font-medium ${requireIdentity ? "text-blue-900" : "text-slate-700"}`}>需要學生具名才能投票</div>
                                <div className="text-[11px] text-slate-500 leading-tight">
                                    {requireIdentity ? "學生需先輸入姓名/座號" : "匿名投票，學生不需登入"}
                                </div>
                            </div>
                        </label>
                    </section>

                    {/* 警告 */}
                    {willClearCorrect && (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <div>
                                選項數量或題型有變動，原本設定的<strong>正確答案會被清除</strong>，儲存後請重設。
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 sm:gap-2">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        disabled={save.isPending}
                        className="text-slate-600"
                    >
                        取消
                    </Button>
                    <Button
                        type="button"
                        onClick={() => save.mutate()}
                        disabled={save.isPending || imageProcessing || validOptionCount < 2}
                        className="gap-1.5 bg-blue-600 hover:bg-blue-700 shadow-sm"
                    >
                        {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        儲存變更
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
