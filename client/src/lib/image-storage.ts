/**
 * 圖片上傳到 Firebase Storage 的 helper。
 *
 * 設計思考：
 *   - 小圖（< 50KB）保留 base64 inline：避免一次 round-trip 上傳 + 一次下載
 *     的延遲，反正 Firestore 1MB 還塞得下
 *   - 大圖（≥ 50KB）上傳 Storage：解 base64 撐爆 Firestore 1MB 的根本問題
 *   - 上傳路徑：questions/{teacherId}/{timestamp}-{random}.{ext}
 *     方便 storage.rules 用 teacherId 做 owner 限制
 */
import {
    ref as storageRef,
    uploadBytes,
    getDownloadURL,
    deleteObject,
} from "firebase/storage";
import { storage, auth } from "./firebase";
import { estimateBase64Size } from "./image-compress";

// 50KB 以下的圖片直接 inline，避免上傳延遲
const INLINE_THRESHOLD_BYTES = 50 * 1024;

const dataUrlToBlob = (dataUrl: string): Blob => {
    const [header, b64] = dataUrl.split(",");
    const mime = header.match(/data:([^;]+)/)?.[1] || "image/jpeg";
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
};

/**
 * 上傳圖片到 Storage。回傳可用於 <img src> 的 https URL。
 * 小圖直接回傳原 base64 dataUrl（不上傳，省 RTT）。
 */
export const uploadImageIfLarge = async (dataUrl: string): Promise<string> => {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("未登入，無法上傳圖片");

    const sizeBytes = estimateBase64Size(dataUrl);
    if (sizeBytes < INLINE_THRESHOLD_BYTES) {
        return dataUrl; // 小圖 inline 即可
    }

    const blob = dataUrlToBlob(dataUrl);
    const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const ref = storageRef(storage, `questions/${userId}/${filename}`);

    await uploadBytes(ref, blob, { contentType: blob.type });
    return await getDownloadURL(ref);
};

/**
 * 從 Storage URL 反推 storage path 並刪除。
 * 對 base64 inline 與舊 imageUrl 安全 no-op。
 */
export const deleteImageFromUrl = async (url: string | undefined): Promise<void> => {
    if (!url || !url.startsWith("https://")) return; // 非 Storage URL 不處理
    try {
        // Firebase Storage download URL 格式：
        //   https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encoded-path}?alt=media&token=...
        const m = url.match(/\/o\/([^?]+)/);
        if (!m) return;
        const path = decodeURIComponent(m[1]);
        const ref = storageRef(storage, path);
        await deleteObject(ref);
    } catch {
        // 檔案可能已被刪除，靜默忽略
    }
};
