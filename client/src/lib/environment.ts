/**
 * GitHub Pages 專用的環境檢測工具
 * 用於判斷是否運行在 GitHub Pages 環境
 */

// 判斷是否為 GitHub Pages 環境
export function isGitHubPages(): boolean {
    // 優先檢查環境變數
    if (import.meta.env.VITE_GH_PAGES === 'true' || import.meta.env.VITE_GH_PAGES === true) {
        return true;
    }

    // 備用：檢查 URL 是否為 github.io 域名
    if (typeof window !== 'undefined') {
        return window.location.hostname.includes('github.io');
    }

    return false;
}

// API 基礎 URL（Vercel 部署時使用）
export function getApiBaseUrl(): string {
    if (isGitHubPages()) {
        // GitHub Pages 不使用 API
        return '';
    }
    return '';
}
