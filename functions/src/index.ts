import { setGlobalOptions } from "firebase-functions/v2";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { notifyAdminCard } from "./notify-line.js";
import { pushGoogleChatCard } from "./google-chat.js";

initializeApp();
setGlobalOptions({ region: "asia-east1" });

const LINE_TOKEN = defineSecret("VOTE_LINE_CHANNEL_ACCESS_TOKEN");
const LINE_USER_ID = defineSecret("VOTE_LINE_ADMIN_USER_ID");
const GOOGLE_CHAT_WEBHOOK_URL = defineSecret("GOOGLE_CHAT_WEBHOOK_URL");

const APP_NAME = "即時投票系統";
const SITE_URL = "https://cagoooo.github.io/vote";

export const reportClientEvent = onCall(
    {
        secrets: [GOOGLE_CHAT_WEBHOOK_URL],
    },
    async (request) => {
        const data = request.data ?? {};
        const status = normalizeStatus(data.status);
        const title = cleanText(data.title, status === "failed" ? "服務發生錯誤" : "服務狀態更新", 80);
        const message = cleanText(data.message, "", 500);
        const progress = cleanText(data.progress, "", 120);
        const context = cleanText(data.context, "前端事件", 120);
        const url = cleanText(data.url, "", 500);
        const details = data.details && typeof data.details === "object" ? data.details : {};
        const auth = request.auth;

        const rows = [
            { label: "進度", value: progress || (status === "success" ? "流程已完成" : "等待處理") },
            { label: "位置", value: context },
            { label: "使用者", value: userLabel(auth?.uid, auth?.token?.email, auth?.token?.name) },
        ];

        Object.entries(details)
            .slice(0, 6)
            .forEach(([key, value]) => rows.push({ label: key, value: cleanText(String(value ?? ""), "-", 200) }));

        await pushGoogleChatCard(
            GOOGLE_CHAT_WEBHOOK_URL.value(),
            {
                status,
                title,
                subtitle: APP_NAME,
                rows,
                body: message || undefined,
                buttons: url ? [{ text: "開啟頁面", url }] : undefined,
            },
            "reportClientEvent"
        );

        return { ok: true };
    }
);

// 老師建立新題目時推播
export const onQuestionCreated = onDocumentCreated(
    {
        document: "questions/{questionId}",
        secrets: [LINE_TOKEN, LINE_USER_ID, GOOGLE_CHAT_WEBHOOK_URL],
    },
    async (event) => {
        const data = event.data?.data();
        if (!data) return;

        const questionId = event.params.questionId;
        const roomCode: string = data.roomCode ?? "—";
        const options: string[] = Array.isArray(data.options) ? data.options : [];

        // 兩欄式選項預覽：1. A   2. B
        const optionLines: string[] = [];
        for (let i = 0; i < Math.min(options.length, 6); i += 2) {
            const left = `${i + 1}. ${trimOpt(options[i])}`;
            const right = options[i + 1] ? `   ${i + 2}. ${trimOpt(options[i + 1])}` : "";
            optionLines.push(left + right);
        }
        const optionPreview = optionLines.join("\n") + (options.length > 6 ? `\n…（共 ${options.length} 項）` : "");

        await notifyAdminCard(
            {
                status: "started",
                title: "新題目已開放投票",
                appName: APP_NAME,
                hero: { label: "🔑 房間代碼", value: roomCode },
                sections: [
                    { type: "label-only", icon: "📝", text: `共 ${options.length} 個選項`, size: "xs" },
                    { type: "text", icon: "", label: "", value: optionPreview },
                ],
                action: { label: "📲 開啟投票頁", uri: `${SITE_URL}/${questionId}` },
                footerNote: "學生可掃 QR 或輸入代碼",
            },
            LINE_TOKEN.value(),
            LINE_USER_ID.value()
        );

        await pushGoogleChatCard(
            GOOGLE_CHAT_WEBHOOK_URL.value(),
            {
                status: "success",
                title: "新題目已開放投票",
                subtitle: APP_NAME,
                rows: [
                    { label: "進度", value: "題目建立完成，學生可開始投票" },
                    { label: "房間代碼", value: roomCode },
                    { label: "選項數", value: `${options.length}` },
                ],
                body: optionPreview,
                buttons: [{ text: "開啟投票頁", url: `${SITE_URL}/${questionId}` }],
            },
            "onQuestionCreated"
        );

        logger.info("[onQuestionCreated] notified", { questionId, roomCode });
    }
);

// 每 15 分鐘掃過期的活動題目，把 active 設 false 並推播
// 順手清掉超過 5 分鐘的舊 reactions（前端只查 30 秒窗口，5 分前的留著沒用）
export const expireOldQuestions = onSchedule(
    {
        schedule: "every 15 minutes",
        timeZone: "Asia/Taipei",
        secrets: [LINE_TOKEN, LINE_USER_ID],
    },
    async () => {
        const db = getFirestore();
        const now = Timestamp.now();

        // === Reactions 清理（避免長期累積佔用 Firestore 容量）===
        try {
            const fiveMinAgo = Timestamp.fromMillis(Date.now() - 5 * 60 * 1000);
            const oldReactions = await db
                .collection("reactions")
                .where("createdAt", "<", fiveMinAgo)
                .limit(500) // 一次最多清 500 筆，避免 timeout
                .get();
            if (!oldReactions.empty) {
                const batch = db.batch();
                oldReactions.docs.forEach((d) => batch.delete(d.ref));
                await batch.commit();
                logger.info(`[cleanup] 清掉 ${oldReactions.size} 筆過期 reactions`);
            }
        } catch (err: any) {
            logger.warn("[cleanup] reactions 清理失敗", { msg: err?.message });
        }

        const snap = await db
            .collection("questions")
            .where("active", "==", true)
            .where("expiresAt", "<=", now)
            .get();

        if (snap.empty) {
            logger.debug("[expireOldQuestions] 無過期題目");
            return;
        }

        logger.info(`[expireOldQuestions] 處理 ${snap.size} 題`);

        for (const doc of snap.docs) {
            const data = doc.data();
            const roomCode: string = data.roomCode ?? "—";
            const options: string[] = Array.isArray(data.options) ? data.options : [];

            // 統計票數
            const votesSnap = await db.collection("votes").where("questionId", "==", doc.id).get();
            const total = votesSnap.size;
            const counts: Record<number, number> = {};
            votesSnap.docs.forEach((v) => {
                const idx = v.data().optionIndex;
                if (typeof idx === "number") counts[idx] = (counts[idx] || 0) + 1;
            });

            // 找出最高票
            let topIdx = -1;
            let topCount = 0;
            Object.entries(counts).forEach(([k, v]) => {
                if (v > topCount) {
                    topCount = v;
                    topIdx = Number(k);
                }
            });
            const topLine =
                topIdx >= 0 ? `${topIdx + 1}. ${trimOpt(options[topIdx] ?? "")}（${topCount} 票）` : "—";

            // 設 active = false
            await doc.ref.update({ active: false, expiredNotifiedAt: FieldValue.serverTimestamp() });

            await notifyAdminCard(
                {
                    status: "warning",
                    title: "題目已自動結束",
                    appName: APP_NAME,
                    hero: { label: "🔑 房間代碼", value: roomCode },
                    sections: [
                        { type: "text", icon: "👥", label: "總票數", value: `${total} 票` },
                        { type: "text", icon: "🏆", label: "最高票", value: topLine },
                    ],
                    action: { label: "📊 查看完整結果", uri: `${SITE_URL}/${doc.id}` },
                    footerNote: "可在「我的題目」重新啟用",
                },
                LINE_TOKEN.value(),
                LINE_USER_ID.value()
            );
        }
    }
);

function trimOpt(s: string): string {
    if (!s) return "";
    return s.length > 12 ? s.substring(0, 12) + "…" : s;
}

function normalizeStatus(value: unknown): "success" | "failed" | "warning" | "started" {
    if (value === "success" || value === "failed" || value === "warning" || value === "started") {
        return value;
    }
    return "warning";
}

function cleanText(value: unknown, fallback: string, maxLength: number): string {
    if (typeof value !== "string") return fallback;
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    return trimmed.slice(0, maxLength);
}

function userLabel(uid: string | undefined, email: unknown, name: unknown): string {
    const emailText = typeof email === "string" && email ? email : "";
    const nameText = typeof name === "string" && name ? name : "";
    const uidText = uid ? uid.slice(0, 12) : "no-auth";
    if (emailText && nameText) return `${nameText} <${emailText}> (${uidText})`;
    if (emailText) return `${emailText} (${uidText})`;
    if (nameText) return `${nameText} (${uidText})`;
    return uidText;
}
