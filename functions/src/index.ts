import { setGlobalOptions } from "firebase-functions/v2";
import { onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { pushGoogleChatCard } from "./google-chat.js";

initializeApp();
setGlobalOptions({ region: "asia-east1" });

const GOOGLE_CHAT_WEBHOOK_URL = defineSecret("GOOGLE_CHAT_WEBHOOK_URL");

const APP_NAME = "即時投票系統";
const SITE_URL = "https://cagoooo.github.io/vote";

// Google Chat 減量設定
// 1. 這些「成功」事件不即時推播：學生投票、建立題目都改由每日彙整（dailyVoteDigest）一次送出
//    （舊版前端快取仍會呼叫，所以後端也要擋）
const SILENT_SUCCESS_CONTEXTS = new Set(["student.vote", "teacher.createQuestion"]);
// 2. 同一種事件（同狀態＋同位置＋同標題＋同題目）在這段時間內只推播一次，其餘合併計數
const THROTTLE_WINDOW_MS = 10 * 60 * 1000;
const THROTTLE_COLLECTION = "_notifyThrottle";

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

        if (status === "success" && SILENT_SUCCESS_CONTEXTS.has(context)) {
            return { ok: true, notified: false, reason: "silent" };
        }

        const throttleKey = [status, context, title, cleanText(String(details.questionId ?? ""), "", 60)].join("|");
        const throttle = await claimNotifySlot(throttleKey);
        if (!throttle.send) {
            return { ok: true, notified: false, reason: "throttled" };
        }

        const rows = [
            { label: "進度", value: progress || (status === "success" ? "流程已完成" : "等待處理") },
            { label: "位置", value: context },
            { label: "使用者", value: userLabel(auth?.uid, auth?.token?.email, auth?.token?.name) },
        ];

        Object.entries(details)
            .slice(0, 6)
            .forEach(([key, value]) => rows.push({ label: key, value: cleanText(String(value ?? ""), "-", 200) }));

        if (throttle.mergedCount > 0) {
            rows.push({
                label: "合併通知",
                value: `上次通知後又發生 ${throttle.mergedCount} 次相同事件（${THROTTLE_WINDOW_MS / 60000} 分鐘內只通知一次）`,
            });
        }

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

        return { ok: true, notified: true };
    }
);

// 每日彙整：取代「每建一題、每結束一題就通知」，一天只送一張卡（只發 Google Chat）
// 2026-11-18 起不再推 LINE：多個網站共用同一個 LINE 官方帳號，免費方案每月 200 則要留給錯誤告警
// 全國老師都在用時，逐題通知會洗版，所以全部集中到傍晚一次看
const DIGEST_TOP_N = 5;
const DIGEST_MAX_QUESTIONS = 200;

export const dailyVoteDigest = onSchedule(
    {
        schedule: "30 17 * * *",
        timeZone: "Asia/Taipei",
        secrets: [GOOGLE_CHAT_WEBHOOK_URL],
    },
    async () => {
        const db = getFirestore();
        const since = Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);

        const [qSnap, voteCountSnap] = await Promise.all([
            db.collection("questions").where("createdAt", ">=", since).limit(DIGEST_MAX_QUESTIONS).get(),
            db.collection("votes").where("timestamp", ">=", since).count().get(),
        ]);
        const newQuestions = qSnap.size;
        const votesToday = voteCountSnap.data().count;

        if (newQuestions === 0 && votesToday === 0) {
            logger.info("[dailyVoteDigest] 今天沒有新題目也沒有投票，不推播");
            return;
        }

        const teachers = new Set(qSnap.docs.map((d) => d.get("teacherId")).filter(Boolean)).size;

        // 每題票數（count 聚合，不用把票全部讀回來）
        const perQuestion = await Promise.all(
            qSnap.docs.map(async (d) => {
                const c = await db.collection("votes").where("questionId", "==", d.id).count().get();
                return { doc: d, votes: c.data().count };
            })
        );
        const top = perQuestion
            .filter((q) => q.votes > 0)
            .sort((a, b) => b.votes - a.votes)
            .slice(0, DIGEST_TOP_N);

        const topLines = await Promise.all(
            top.map(async ({ doc, votes }, i) => {
                const data = doc.data();
                const type: string = data.questionType ?? "single";
                const options: string[] = Array.isArray(data.options) ? data.options : [];
                let lead = "";
                if (type !== "shortanswer") {
                    const vs = await db.collection("votes").where("questionId", "==", doc.id).get();
                    const counts: Record<number, number> = {};
                    vs.docs.forEach((v) => {
                        const x = v.data();
                        const picks: unknown[] = typeof x.optionIndex === "number" ? [x.optionIndex] : Array.isArray(x.optionIndices) ? x.optionIndices : [];
                        picks.forEach((idx) => {
                            if (typeof idx === "number") counts[idx] = (counts[idx] || 0) + 1;
                        });
                    });
                    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
                    if (best) lead = `｜最高：${trimOpt(options[Number(best[0])] ?? `選項 ${Number(best[0]) + 1}`)}`;
                }
                return `${i + 1}. 房間 ${data.roomCode ?? "—"}（${QUESTION_TYPE_LABEL[type] ?? type}）${votes} 票${lead}`;
            })
        );

        const rows = [
            { label: "統計區間", value: "過去 24 小時" },
            { label: "新題目", value: `${newQuestions} 題${newQuestions >= DIGEST_MAX_QUESTIONS ? "以上" : ""}` },
            { label: "出題老師", value: `${teachers} 位` },
            { label: "投票", value: `${votesToday} 票` },
        ];
        const body = topLines.length ? ["票數最多的題目：", ...topLines].join("\n") : "今天的新題目還沒有人投票";

        await pushGoogleChatCard(
            GOOGLE_CHAT_WEBHOOK_URL.value(),
            {
                status: "success",
                title: "今日投票彙整",
                subtitle: APP_NAME,
                rows,
                body,
                buttons: [{ text: "開啟網站", url: SITE_URL }],
            },
            "dailyVoteDigest"
        );

        logger.info("[dailyVoteDigest] sent", { newQuestions, votesToday, teachers });
    }
);

// 每 15 分鐘掃過期的活動題目，把 active 設 false（不推播，統計交給每日彙整）
// 順手清掉超過 5 分鐘的舊 reactions（前端只查 30 秒窗口，5 分前的留著沒用）
export const expireOldQuestions = onSchedule(
    {
        schedule: "every 15 minutes",
        timeZone: "Asia/Taipei",
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

        // 只把題目關掉；結果統計改由每日彙整（dailyVoteDigest）一次送出
        const batch = db.batch();
        snap.docs.forEach((d) => batch.update(d.ref, { active: false, expiredNotifiedAt: FieldValue.serverTimestamp() }));
        await batch.commit();
    }
);

const QUESTION_TYPE_LABEL: Record<string, string> = {
    single: "單選",
    multiple: "多選",
    truefalse: "是非",
    shortanswer: "簡答",
};

// 節流：同一個 key 在 THROTTLE_WINDOW_MS 內只放行一次，其餘累計到 suppressed
async function claimNotifySlot(key: string): Promise<{ send: boolean; mergedCount: number }> {
    const db = getFirestore();
    const docId = Buffer.from(key).toString("base64url").slice(0, 400);
    const ref = db.collection(THROTTLE_COLLECTION).doc(docId);
    try {
        return await db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            const nowMs = Date.now();
            const lastSentMs = snap.exists ? (snap.get("lastSentAt") as Timestamp | undefined)?.toMillis() ?? 0 : 0;
            const suppressed = snap.exists ? Number(snap.get("suppressed") ?? 0) : 0;
            if (nowMs - lastSentMs < THROTTLE_WINDOW_MS) {
                tx.set(ref, { key, suppressed: suppressed + 1 }, { merge: true });
                return { send: false, mergedCount: 0 };
            }
            tx.set(ref, {
                key,
                lastSentAt: Timestamp.fromMillis(nowMs),
                suppressed: 0,
                expireAt: Timestamp.fromMillis(nowMs + 24 * 60 * 60 * 1000),
            });
            return { send: true, mergedCount: suppressed };
        });
    } catch (err: any) {
        // 節流失敗時寧可照常通知，不要漏掉錯誤
        logger.warn("[claimNotifySlot] throttle failed, sending anyway", { message: err?.message });
        return { send: true, mergedCount: 0 };
    }
}

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
