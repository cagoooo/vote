import * as logger from "firebase-functions/logger";

const LINE_PUSH_API = "https://api.line.me/v2/bot/message/push";

const CARD_THEMES = {
    started: { headerBg: "#3B82F6", headerSubColor: "#DBEAFE", icon: "🆕" },
    success: { headerBg: "#10B981", headerSubColor: "#D1FAE5", icon: "✅" },
    failed: { headerBg: "#EF4444", headerSubColor: "#FEE2E2", icon: "❌" },
    warning: { headerBg: "#F59E0B", headerSubColor: "#FEF3C7", icon: "⚠️" },
} as const;

export type CardSpec = {
    status: keyof typeof CARD_THEMES;
    title: string;
    appName?: string;
    /** 大字突顯區（例如房間代碼）— 顯示在內容上方，藍底圓角 */
    hero?: { label: string; value: string };
    /** 自由排版的內容區塊（保持 wrap 不被截）*/
    sections: Array<
        | { type: "text"; icon?: string; label?: string; value: string }
        | { type: "label-only"; icon?: string; text: string; size?: "xs" | "sm" }
        | { type: "divider" }
    >;
    /** 點擊按鈕（uri action）*/
    action?: { label: string; uri: string };
    footerNote?: string;
};

export async function notifyAdminCard(
    card: CardSpec,
    token: string | undefined,
    userId: string | undefined
): Promise<void> {
    if (!token || !userId) {
        logger.warn("[notify-line] 缺 token 或 userId, 跳過推播");
        return;
    }

    const theme = CARD_THEMES[card.status];
    const flex = buildFlexBubble(card);
    const altText = `${theme.icon} ${card.title}`.substring(0, 380);

    try {
        const res = await fetch(LINE_PUSH_API, {
            method: "POST",
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                to: userId,
                messages: [{ type: "flex", altText, contents: flex }],
            }),
        });

        if (!res.ok) {
            const body = await res.text();
            logger.warn("[notify-line] Flex 失敗, fallback 純文字", { status: res.status, body });
            await fetch(LINE_PUSH_API, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json; charset=utf-8",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    to: userId,
                    messages: [{ type: "text", text: cardToPlainText(card) }],
                }),
            });
        }
    } catch (err: any) {
        logger.warn("[notify-line] push failed", { msg: err?.message });
    }
}

function buildFlexBubble(card: CardSpec) {
    const theme = CARD_THEMES[card.status];
    const now = new Intl.DateTimeFormat("zh-TW", {
        timeZone: "Asia/Taipei",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(new Date());

    // ---- Header ----
    const headerContents: any[] = [
        {
            type: "text",
            text: `${theme.icon}  ${card.title}`,
            color: "#FFFFFF",
            weight: "bold",
            size: "md",
            wrap: true,
        },
    ];
    if (card.appName) {
        headerContents.push({
            type: "text",
            text: card.appName,
            color: theme.headerSubColor,
            size: "xs",
            margin: "sm",
        });
    }

    // ---- Body ----
    const bodyContents: any[] = [];

    // Hero 大字區
    if (card.hero) {
        bodyContents.push({
            type: "box",
            layout: "vertical",
            backgroundColor: "#EFF6FF",
            cornerRadius: "8px",
            paddingAll: "12px",
            margin: "none",
            contents: [
                {
                    type: "text",
                    text: card.hero.label,
                    size: "xs",
                    color: "#1E40AF",
                    align: "center",
                    weight: "regular",
                },
                {
                    type: "text",
                    text: card.hero.value,
                    size: "3xl",
                    color: "#1E3A8A",
                    align: "center",
                    weight: "bold",
                    margin: "sm",
                },
            ],
        });
    }

    // 各 section
    card.sections.forEach((s) => {
        if (s.type === "divider") {
            bodyContents.push({ type: "separator", margin: "md", color: "#E5E7EB" });
        } else if (s.type === "label-only") {
            bodyContents.push({
                type: "text",
                text: `${s.icon ? s.icon + " " : ""}${s.text}`,
                size: s.size ?? "sm",
                color: "#475569",
                wrap: true,
                margin: "sm",
            });
        } else {
            // type: "text"
            // 用單一 wrap text 顯示「icon label：value」, 不分欄避免 label 被截
            const prefix = `${s.icon ? s.icon + " " : ""}${s.label ? s.label + "：" : ""}`;
            bodyContents.push({
                type: "text",
                text: `${prefix}${s.value}`,
                size: "sm",
                color: "#1E293B",
                wrap: true,
                margin: "sm",
            });
        }
    });

    const body: any = {
        type: "box",
        layout: "vertical",
        spacing: "none",
        paddingAll: "16px",
        contents: bodyContents,
    };

    // ---- Footer (button + time) ----
    const footerContents: any[] = [];
    if (card.action) {
        footerContents.push({
            type: "button",
            style: "primary",
            color: theme.headerBg,
            height: "sm",
            action: {
                type: "uri",
                label: card.action.label.substring(0, 38),
                uri: card.action.uri,
            },
        });
    }
    footerContents.push({
        type: "text",
        text: card.footerNote ? `${now} · ${card.footerNote}` : now,
        color: "#94A3B8",
        size: "xxs",
        align: "end",
        wrap: true,
        margin: card.action ? "md" : "none",
    });

    return {
        type: "bubble",
        size: "kilo",
        header: {
            type: "box",
            layout: "vertical",
            backgroundColor: theme.headerBg,
            paddingAll: "16px",
            contents: headerContents,
        },
        body,
        footer: {
            type: "box",
            layout: "vertical",
            paddingAll: "12px",
            contents: footerContents,
        },
    };
}

function cardToPlainText(card: CardSpec): string {
    const theme = CARD_THEMES[card.status];
    const parts = [`${theme.icon} ${card.title}`];
    if (card.appName) parts.push(`(${card.appName})`);
    if (card.hero) parts.push("", `${card.hero.label}：${card.hero.value}`);
    parts.push("");
    card.sections.forEach((s) => {
        if (s.type === "divider") return;
        if (s.type === "label-only") {
            parts.push(`${s.icon || ""} ${s.text}`.trim());
        } else {
            const prefix = `${s.icon ? s.icon + " " : ""}${s.label ? s.label + "：" : ""}`;
            parts.push(`${prefix}${s.value}`);
        }
    });
    if (card.action) parts.push("", `🔗 ${card.action.label}：${card.action.uri}`);
    if (card.footerNote) parts.push("", card.footerNote);
    return parts.filter((p) => p !== undefined).join("\n").substring(0, 4900);
}
