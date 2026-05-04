/**
 * 把 base64 圖片壓縮到 Firestore 單一文件 1 MB 限制以內。
 * Firestore 硬限 1,048,487 bytes，我們留 30% 餘裕（給 options/metadata 用）。
 *
 * 策略：
 *   1. 圖片 ≤ 上限 → 直接回傳
 *   2. 超過 → 縮到最長邊 1600px → JPEG quality 0.85 → 0.45 階梯式壓
 *   3. 還超過 → 整體 scale × 0.8 重來，最多 6 輪
 */
const MAX_BYTES = 700 * 1024; // 700KB 安全水位

export interface CompressResult {
    dataUrl: string;
    originalBytes: number;
    finalBytes: number;
    didCompress: boolean;
}

export async function compressImageToFit(dataUrl: string): Promise<CompressResult> {
    const originalBytes = estimateBase64Size(dataUrl);
    if (originalBytes <= MAX_BYTES) {
        return { dataUrl, originalBytes, finalBytes: originalBytes, didCompress: false };
    }

    const img = await loadImage(dataUrl);
    let baseW = img.naturalWidth;
    let baseH = img.naturalHeight;

    // 第一刀：把超大圖縮到合理上限
    const MAX_DIM = 1600;
    if (baseW > MAX_DIM || baseH > MAX_DIM) {
        const r = MAX_DIM / Math.max(baseW, baseH);
        baseW = Math.round(baseW * r);
        baseH = Math.round(baseH * r);
    }

    const QUALITIES = [0.85, 0.75, 0.65, 0.55, 0.45];
    let scale = 1;

    for (let attempt = 0; attempt < 6; attempt++) {
        const w = Math.max(200, Math.round(baseW * scale));
        const h = Math.max(200, Math.round(baseH * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("無法建立 canvas context");
        // PNG 透明背景轉 JPEG 會變黑，先填白底
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        for (const q of QUALITIES) {
            const out = canvas.toDataURL("image/jpeg", q);
            const bytes = estimateBase64Size(out);
            if (bytes <= MAX_BYTES) {
                return { dataUrl: out, originalBytes, finalBytes: bytes, didCompress: true };
            }
        }
        // 還是超過 → 整體再縮 20%
        scale *= 0.8;
    }

    throw new Error("圖片壓縮後仍超過 700 KB 上限，請使用較小的圖片");
}

export function estimateBase64Size(dataUrl: string): number {
    const idx = dataUrl.indexOf(",");
    const b64 = idx >= 0 ? dataUrl.substring(idx + 1) : dataUrl;
    return Math.floor(b64.length * 0.75);
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("無法載入圖片"));
        img.src = src;
    });
}
