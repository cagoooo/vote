import { useLocation } from "wouter";

const SCHOOL_PAGE_URL =
    "https://www.smes.tyc.edu.tw/modules/tadnews/page.php?ncsn=11&nsn=16#a5";

/**
 * 共用頁尾署名（阿凱老師）。
 * 全螢幕投影模式 /present/:id 不顯示，避免擋彩花動畫與大字票數。
 */
export function SiteFooter() {
    const [location] = useLocation();
    if (location.startsWith("/present/")) return null;

    return (
        <footer className="site-credit no-print w-full text-center px-4 py-6 mt-8 text-sm text-slate-500">
            Made with{" "}
            <span aria-label="愛心" className="site-credit__heart">
                ❤️
            </span>{" "}
            by{" "}
            <a
                href={SCHOOL_PAGE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="site-credit__author text-slate-600 hover:text-amber-700 transition-colors"
            >
                阿凱老師
            </a>
        </footer>
    );
}
