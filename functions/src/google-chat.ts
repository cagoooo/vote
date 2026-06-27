import * as logger from "firebase-functions/logger";

type ChatStatus = "success" | "failed" | "warning" | "started";

type ChatRow = {
    label: string;
    value: string;
};

type ChatButton = {
    text: string;
    url: string;
};

type ChatCard = {
    status: ChatStatus;
    title: string;
    subtitle?: string;
    rows?: ChatRow[];
    body?: string;
    buttons?: ChatButton[];
};

const STATUS_LABEL: Record<ChatStatus, string> = {
    success: "成功",
    failed: "失敗",
    warning: "警示",
    started: "進行中",
};

const STATUS_COLOR: Record<ChatStatus, string> = {
    success: "#0F9D58",
    failed: "#D93025",
    warning: "#F29900",
    started: "#1A73E8",
};

export async function pushGoogleChatCard(
    webhookUrl: string | undefined,
    card: ChatCard,
    contextLabel = "GoogleChat"
): Promise<void> {
    const url = webhookUrl?.trim();
    if (!url) {
        logger.warn(`[${contextLabel}] GOOGLE_CHAT_WEBHOOK_URL is not configured`);
        return;
    }

    const statusText = STATUS_LABEL[card.status];
    const text = `[${statusText}] ${card.title}`.slice(0, 1000);
    const widgets: any[] = [
        {
            decoratedText: {
                topLabel: "狀態",
                text: `<font color="${STATUS_COLOR[card.status]}"><b>${escapeHtml(statusText)}</b></font>`,
                wrapText: true,
            },
        },
    ];

    for (const row of card.rows ?? []) {
        widgets.push({
            decoratedText: {
                topLabel: escapeHtml(row.label),
                text: escapeHtml(row.value),
                wrapText: true,
            },
        });
    }

    if (card.body) {
        widgets.push({ textParagraph: { text: escapeHtml(card.body) } });
    }

    if (card.buttons?.length) {
        widgets.push({
            buttonList: {
                buttons: card.buttons.map((button) => ({
                    text: button.text.slice(0, 40),
                    onClick: { openLink: { url: button.url } },
                })),
            },
        });
    }

    const payload = {
        text,
        cardsV2: [
            {
                cardId: `vote-${Date.now()}`,
                card: {
                    header: {
                        title: card.title,
                        subtitle: card.subtitle ?? "即時服務狀態通知",
                    },
                    sections: [{ widgets }],
                },
            },
        ],
    };

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json; charset=utf-8" },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            logger.warn(`[${contextLabel}] Google Chat notification failed`, {
                status: res.status,
                body: await res.text(),
            });
        }
    } catch (err: any) {
        logger.warn(`[${contextLabel}] Google Chat notification error`, { message: err?.message });
    }
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .slice(0, 1500);
}
