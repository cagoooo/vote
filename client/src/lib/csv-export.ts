// 簡單的 CSV 工具：純前端、無外部依賴、支援 Excel 中文
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "./firebase";
import type { FirestoreQuestion } from "./firestore-voting";

const escapeCSV = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (/[",\n\r]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
};

const downloadCSV = (filename: string, rows: (string | number | null)[][]) => {
    const csv = rows.map((r) => r.map(escapeCSV).join(",")).join("\r\n");
    // 加 UTF-8 BOM 讓 Excel 開繁中不亂碼
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

const formatTimestamp = (ts: any): string => {
    if (!ts?.toDate) return "";
    return ts.toDate().toLocaleString("zh-TW", { hour12: false });
};

// 匯出單一題目的完整投票紀錄（兩個 sheet 用兩個 CSV 取代）
export const exportQuestionVotes = async (question: FirestoreQuestion) => {
    // 抓所有 votes
    const votesSnap = await getDocs(
        query(
            collection(db, "votes"),
            where("questionId", "==", question.id),
            orderBy("timestamp", "asc")
        )
    );
    const votes = votesSnap.docs.map((d) => d.data());

    const counts: Record<number, number> = {};
    votes.forEach((v) => {
        counts[v.optionIndex] = (counts[v.optionIndex] || 0) + 1;
    });
    const total = votes.length;

    // Section 1: 題目摘要
    const rows: (string | number | null)[][] = [
        ["即時投票系統 - 投票結果"],
        ["題目 ID", question.id],
        ["房間代碼", question.roomCode ?? ""],
        ["建立時間", formatTimestamp(question.createdAt)],
        ["到期時間", formatTimestamp(question.expiresAt)],
        ["狀態", question.active ? "進行中" : "已停用"],
        ["總票數", total],
        [],
        ["選項統計"],
        ["選項編號", "選項內容", "票數", "百分比", "是否為正解"],
    ];
    question.options.forEach((opt, i) => {
        const count = counts[i] || 0;
        const pct = total ? ((count / total) * 100).toFixed(1) + "%" : "0%";
        rows.push([i + 1, opt, count, pct, i === question.correctAnswer ? "是" : ""]);
    });

    // Section 2: 個別投票紀錄
    const hasIdentity = votes.some((v: any) => v.voterName || v.voterSeat);
    if (hasIdentity) {
        rows.push([], ["投票明細"], ["時間", "座號", "姓名", "選項編號", "選項內容", "匿名 ID"]);
        votes.forEach((v: any) => {
            rows.push([
                formatTimestamp(v.timestamp),
                v.voterSeat ?? "",
                v.voterName ?? "",
                (v.optionIndex ?? -1) + 1,
                question.options[v.optionIndex] ?? "",
                v.userId ?? "",
            ]);
        });
    } else {
        rows.push([], ["投票明細"], ["時間", "選項編號", "選項內容", "投票者匿名 ID"]);
        votes.forEach((v: any) => {
            rows.push([
                formatTimestamp(v.timestamp),
                (v.optionIndex ?? -1) + 1,
                question.options[v.optionIndex] ?? "",
                v.userId ?? "",
            ]);
        });
    }

    const safeCode = (question.roomCode || question.id).replace(/[^A-Za-z0-9]/g, "_");
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadCSV(`vote_${safeCode}_${dateStr}.csv`, rows);
};
