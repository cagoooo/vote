import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// GitHub Pages 專用配置
export default defineConfig({
    plugins: [
        react(),
        themePlugin(),
    ],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "client", "src"),
            "@shared": path.resolve(__dirname, "shared"),
        },
    },
    root: path.resolve(__dirname, "client"),
    base: process.env.VITE_BASE_URL || "/",
    build: {
        outDir: path.resolve(__dirname, "dist/public"),
        emptyOutDir: true,
    },
    define: {
        'import.meta.env.VITE_GH_PAGES': JSON.stringify(process.env.VITE_GH_PAGES === 'true'),
    },
});
