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
        <footer className="site-credit no-print w-full">
            <div className="max-w-4xl mx-auto px-4 pt-3 pb-4 text-center text-xs text-slate-400 border-t border-slate-200/60 mt-2">
                Made with{" "}
                <span aria-label="愛心" className="site-credit__heart">
                    ❤️
                </span>{" "}
                by{" "}
                <a
                    href={SCHOOL_PAGE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="site-credit__author text-slate-500 hover:text-amber-700 border-b border-dotted border-slate-300 hover:border-amber-600 transition-colors"
                >
                    阿凱老師
                </a>
            </div>
        </footer>
    );
}
