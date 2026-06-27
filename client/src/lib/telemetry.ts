import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

type ServiceStatus = "success" | "failed" | "warning" | "started";

type ReportPayload = {
    status: ServiceStatus;
    title: string;
    context: string;
    progress?: string;
    message?: string;
    details?: Record<string, string | number | boolean | null | undefined>;
};

const reportClientEvent = httpsCallable(functions, "reportClientEvent");

export function reportServiceEvent(payload: ReportPayload): void {
    reportClientEvent({
        ...payload,
        url: window.location.href,
        details: compactDetails(payload.details),
    }).catch((err) => {
        console.warn("[telemetry] reportClientEvent failed", err);
    });
}

export function errorDetails(error: unknown): Record<string, string> {
    if (!error || typeof error !== "object") {
        return { message: String(error ?? "unknown error") };
    }
    const err = error as { code?: unknown; message?: unknown; name?: unknown };
    return {
        code: typeof err.code === "string" ? err.code : "",
        name: typeof err.name === "string" ? err.name : "",
        message: typeof err.message === "string" ? err.message : String(error),
    };
}

function compactDetails(details: ReportPayload["details"]): Record<string, string | number | boolean> {
    if (!details) return {};
    return Object.fromEntries(
        Object.entries(details)
            .filter(([, value]) => value !== undefined && value !== null && value !== "")
            .map(([key, value]) => [key, value as string | number | boolean])
    );
}
