import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import { VitePWA } from "vite-plugin-pwa";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 注入版本字串：日期 + git short hash（CI 內也能跑，git 不在時 fallback timestamp）
let commitHash = "unknown";
try {
    commitHash = execSync("git rev-parse --short HEAD").toString().trim();
} catch {
    /* fallback below */
}
const buildDate = new Date().toISOString().slice(0, 10);
const APP_VERSION = `${buildDate}-${commitHash}`;

// GitHub Pages 專用配置
export default defineConfig({
    plugins: [
        react(),
        themePlugin(),
        VitePWA({
            // 用 prompt 模式：偵測新版時顯示通知讓使用者按更新，避免 infinite reload
            registerType: "prompt",
            // dev mode 不啟用 SW，避免快取干擾開發
            devOptions: { enabled: false },
            // 用 GitHub Pages base path
            base: "/vote/",
            scope: "/vote/",
            includeAssets: ["favicon.png", "logo.png", "apple-touch-icon.png"],
            manifest: {
                name: "即時投票系統",
                short_name: "投票",
                description: "教室即時投票系統 — 老師建題、學生掃碼即投",
                theme_color: "#3B82F6",
                background_color: "#FFFFFF",
                display: "standalone",
                orientation: "portrait",
                start_url: "/vote/",
                scope: "/vote/",
                lang: "zh-TW",
                icons: [
                    { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
                    { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
                    { src: "pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
                ],
            },
            workbox: {
                // Precache 所有 build 出來的 hashed asset（自動帶 hash → URL bust）
                globPatterns: ["**/*.{js,css,html,png,svg,ico,woff2}"],
                // SPA navigation fallback：未命中精確路徑都回 index.html
                navigateFallback: "/vote/index.html",
                // Firestore / LINE / Google API 不快取，永遠走網路
                navigateFallbackDenylist: [/^\/api/, /^\/_/],
                runtimeCaching: [
                    {
                        // Firestore real-time / Auth API 永遠網路優先
                        urlPattern: /^https:\/\/(firestore|identitytoolkit|securetoken)\.googleapis\.com\/.*/,
                        handler: "NetworkOnly",
                    },
                ],
                // prompt 模式：兩者都 false，由 UI 完全控制 SW 接管時機
                // 之前 clientsClaim:true 配 skipWaiting:false 會在手機上造成 lifecycle 異常 → 按更新後又跳更新提示
                skipWaiting: false,
                clientsClaim: false,
                cleanupOutdatedCaches: true,
                // bundle 較大，提高上限避免 warning（單一 chunk ~970KB）
                maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
            },
        }),
    ],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "client", "src"),
            "@shared": path.resolve(__dirname, "shared"),
        },
    },
    root: path.resolve(__dirname, "client"),
    base: "/vote/",
    build: {
        outDir: path.resolve(__dirname, "dist/public"),
        emptyOutDir: true,
        rollupOptions: {
            output: {
                manualChunks: {
                    // 把 firebase / framer / qr 各自拆 chunk，避免單一 bundle 過大
                    "firebase": ["firebase/app", "firebase/auth", "firebase/firestore", "firebase/storage"],
                    "motion": ["framer-motion"],
                    "qr": ["react-qr-code"],
                    "confetti": ["canvas-confetti"],
                },
            },
        },
    },
    define: {
        "import.meta.env.VITE_GH_PAGES": JSON.stringify(process.env.VITE_GH_PAGES === "true"),
        __APP_VERSION__: JSON.stringify(APP_VERSION),
    },
});
