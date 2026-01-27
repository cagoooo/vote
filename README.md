# 即時投票系統 (Real-time Voting System)

一個專為教室環境設計的即時投票系統，讓老師可以建立互動問答，學生透過 QR Code 或連結即時參與投票。

![Screenshot](client/public/screen.png)

---

## 📋 目錄

- [功能特色](#-功能特色)
- [技術架構](#-技術架構)
- [系統需求](#-系統需求)
- [安裝步驟](#-安裝步驟)
- [使用說明 (USAGE.md)](USAGE.md)
- [API 端點](#-api-端點)
- [專案結構](#-專案結構)
- [部署指南](#-部署指南)
- [GitHub 部署策略](#-github-部署策略)
- [常見問題](#-常見問題)

---

## ✨ 功能特色

### 教師端功能
- **問題建立**：上傳圖片並設定多個選項
- **圖片工具**：
  - 截圖上傳：支援拖放與剪貼簿貼上
  - 白板繪製：多色畫筆與橡皮擦工具
  - 圖片標註：在上傳圖片上進行繪製標記
  - 圖片裁切：精確裁切需要的區域
- **QR Code 生成**：自動產生投票連結 QR Code，方便學生掃描
- **投票統計**：即時顯示各選項投票數與百分比
- **正確答案管理**：
  - 設定正確答案
  - 控制答案顯示/隱藏
- **投票控制**：重置投票或重新建立問題
- **社群分享**：支援 Facebook、X (Twitter)、LINE 分享結果

### 學生端功能
- **掃描投票**：透過 QR Code 掃描進入投票頁面
- **即時投票**：點擊選項即可完成投票
- **防止重複投票**：使用 Session 追蹤確保每人只能投一次
- **即時結果**：投票後可即時查看投票統計
- **動態動畫**：使用 Framer Motion 提供流暢的視覺體驗

---

## 🏗 技術架構

### 前端 (Frontend)
| 技術 | 說明 |
|------|------|
| React 18 | 使用 TypeScript 進行型別安全開發 |
| Vite | 快速開發與建置工具 |
| Tailwind CSS | 原子化 CSS 框架進行樣式設計 |
| Radix UI + shadcn/ui | 無障礙 UI 元件庫 |
| TanStack Query | 伺服器狀態管理與資料快取 |
| Framer Motion | 動畫效果庫 |
| Wouter | 輕量級路由庫 |
| react-qr-code | QR Code 生成 |
| React Image Crop | 圖片裁切工具 |

### 後端 (Backend)
| 技術 | 說明 |
|------|------|
| Express.js | Node.js Web 框架 |
| TypeScript | 型別安全支援 |
| express-session | Session 管理與防重複投票 |
| Drizzle ORM | 資料庫 ORM (PostgreSQL) |
| Zod | 資料驗證 |

### 資料儲存
| 儲存方式 | 說明 |
|----------|------|
| 記憶體儲存 | 目前使用 `MemStorage` 類別進行開發測試 |
| PostgreSQL | 已定義 Drizzle ORM Schema，可連接 Neon Database |

---

## 💻 系統需求

- **Node.js**: 20.x 或更高版本
- **npm**: 9.x 或更高版本
- **作業系統**: Windows / macOS / Linux
- **瀏覽器**: Chrome、Firefox、Safari、Edge (現代版本)

---

## 📦 安裝步驟

### 1. 複製專案
```bash
git clone <repository-url>
cd song
```

### 2. 安裝依賴
```bash
npm install
```

### 3. 啟動開發伺服器
```bash
npm run dev
```

### 4. 開啟瀏覽器
前往 `http://localhost:5000`

---

## 📖 使用說明

### 教師端操作流程

#### 步驟 1：上傳題目圖片
1. 進入首頁 (`/`)
2. 選擇圖片上傳方式：
   - **截圖上傳**：拖放圖片或使用 Ctrl+V 貼上剪貼簿內容
   - **白板繪製**：點擊「白板」按鈕，使用畫筆繪製題目
   - **圖片標註**：上傳圖片後，點擊「標註」進行繪製

#### 步驟 2：設定選項
1. 在「選項設置」區域填寫選項內容
2. 預設有 3 個選項，可點擊「添加選項」增加
3. 點擊選項旁的 `-` 按鈕可移除選項（最少需 2 個）

#### 步驟 3：建立問題
1. 確認圖片與選項設定完成
2. 點擊「建立問題」按鈕
3. 系統會自動產生 QR Code

#### 步驟 4：讓學生投票
1. 將 QR Code 投影或分享給學生
2. 學生掃描後即可進入投票頁面
3. 即時查看投票統計

#### 步驟 5：設定與顯示正確答案
1. 在「正確答案管理」區域點擊正確選項
2. 選擇「顯示答案」讓學生看到正確答案標記

#### 步驟 6：投票控制
- **重置投票**：清除所有投票記錄，讓學生可以重新投票
- **重新建立投票**：清除所有設定，重新開始

### 學生端操作流程

1. 使用手機掃描老師提供的 QR Code
2. 網頁載入後，查看題目圖片
3. 點擊選擇答案選項
4. 投票成功後，可即時查看投票結果

---

## 🔌 API 端點

### 問題管理

| 方法 | 端點 | 說明 |
|------|------|------|
| POST | `/api/questions` | 建立新問題 |
| GET | `/api/questions/:id` | 取得指定問題 |
| GET | `/api/questions/active` | 取得目前活動問題 |

### 投票功能

| 方法 | 端點 | 說明 |
|------|------|------|
| POST | `/api/questions/:id/vote` | 提交投票 |
| GET | `/api/questions/:id/votes` | 取得投票結果 |
| POST | `/api/questions/:id/reset-votes` | 重置投票 |

### 答案管理

| 方法 | 端點 | 說明 |
|------|------|------|
| POST | `/api/questions/:id/correct-answer` | 設定正確答案 |
| POST | `/api/questions/:id/show-answer` | 顯示/隱藏答案 |

---

## 📁 專案結構

```
song/
├── client/                    # 前端程式碼
│   ├── index.html             # HTML 入口
│   ├── public/                # 靜態資源
│   │   ├── favicon.png        # 網站圖示
│   │   ├── logo.png           # Logo
│   │   ├── screen.png         # 截圖預覽
│   │   └── sounds/            # 音效檔案
│   └── src/
│       ├── App.tsx            # 主應用程式
│       ├── main.tsx           # 進入點
│       ├── index.css          # 全域樣式
│       ├── components/        # React 元件
│       │   ├── floating-ad-button.tsx    # 浮動按鈕
│       │   ├── image-annotator.tsx       # 圖片標註
│       │   ├── qr-display.tsx            # QR Code 顯示
│       │   ├── screenshot-upload.tsx     # 截圖上傳
│       │   ├── share-button.tsx          # 社群分享
│       │   ├── voting-stats.tsx          # 投票統計
│       │   ├── whiteboard.tsx            # 白板功能
│       │   └── ui/                       # UI 基礎元件
│       ├── hooks/             # 自定義 Hooks
│       ├── lib/               # 工具函式
│       └── pages/             # 頁面元件
│           ├── teacher.tsx    # 教師端頁面
│           ├── student.tsx    # 學生端頁面
│           └── not-found.tsx  # 404 頁面
├── server/                    # 後端程式碼
│   ├── index.ts               # 伺服器入口
│   ├── routes.ts              # API 路由
│   ├── storage.ts             # 資料儲存
│   └── vite.ts                # Vite 開發伺服器整合
├── shared/                    # 共用程式碼
│   └── schema.ts              # 資料庫 Schema 定義
├── package.json               # NPM 設定
├── vite.config.ts             # Vite 設定
├── tailwind.config.ts         # Tailwind CSS 設定
├── drizzle.config.ts          # Drizzle ORM 設定
├── tsconfig.json              # TypeScript 設定
├── build.sh                   # 建置腳本
├── post-build.js              # 建置後處理腳本
└── .replit                    # Replit 平台設定
```

---

## 🚀 部署指南

### 方案一：Vercel 部署 (推薦)

Vercel 支援 Node.js 後端，資料暫存於伺服器記憶體。

#### 部署步驟

1. **推送專案到 GitHub**
   ```bash
   git add .
   git commit -m "Add Vercel deployment support"
   git push origin main
   ```

2. **在 Vercel 建立專案**
   - 前往 [vercel.com](https://vercel.com)
   - 點擊「New Project」
   - 選擇你的 GitHub 儲存庫
   - 點擊「Deploy」

3. **自動部署完成**
   - Vercel 會自動偵測設定並完成部署
   - 取得部署 URL，例如 `https://your-app.vercel.app`

---

### 🚀 GitHub 部署策略

針對您的 GitHub 部署需求，我們提供以下兩種完整移植方案：

### 方案 A：GitHub Pages (純前端模式 - 快速部署)
如果您只需要在課堂上由老師電腦投影展示，這是最簡單的方式。

1. **修改配置**：確保 `vite.config.gh-pages.ts` 中的 `base` 設定正確。
2. **建置指令**：執行 `npm run build:gh-pages`。
3. **部署**：將 `dist/public` 資料夾內容上傳至 GitHub 儲存庫的 `gh-pages` 分支。
4. **優點**：完全免費，直接在 GitHub 網址瀏覽。
5. **缺點**：學生投票資料僅存在各自瀏覽器，老師端無法即時看到統計（除非使用方案 B）。

### 方案 B：GitHub Actions + Firebase (全功能模式 - 推薦)
由於您環境中已安裝 Firebase CLI，這是最完美的移植方案，能保留即時同步功能。

1. **初始化**：在專案根目錄執行 `firebase init`。
2. **設定 Secrets**：在 GitHub Repository 的 Settings > Secrets 中加入 Firebase Token。
3. **自動化部署**：建立 `.github/workflows/firebase-deploy.yml`，設定在 push 時自動執行 `npm run build` 並 `firebase deploy`。
4. **優點**：支援跨裝置即時投票、資料持久化、效能極佳。

---

---

### Replit 部署 (原生支援)

此專案原生設計用於 Replit 平台，只需：

1. 在 Replit 上 Fork 專案
2. 執行 `npm run dev` 進行開發
3. 點擊「Deploy」按鈕進行部署
4. 系統會自動執行 `build.sh` 進行建置

### Docker 部署

建立 `Dockerfile`：
```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 5000
CMD ["npm", "start"]
```

---

## ❓ 常見問題

### Q: 為什麼我無法投票？
**A:** 系統使用 Session 追蹤防止重複投票。若被判定已投票，可能是：
- 同一瀏覽器已投過票
- 老師重置投票後，需重新整理頁面

### Q: QR Code 無法掃描？
**A:** 確認：
1. 開發環境需使用內網 IP 而非 localhost
2. 確保手機與電腦在同一網路下

### Q: 投票資料會保留多久？
**A:** 目前使用記憶體儲存，伺服器重啟後資料會清除。如需持久化，需連接 PostgreSQL 資料庫。

### Q: 如何連接資料庫？
**A:** 設定環境變數：
```bash
DATABASE_URL=postgresql://user:password@host:port/database
```

然後執行資料庫遷移：
```bash
npm run db:push
```

---

## 📄 授權條款

MIT License

---

## 🙏 致謝

- [Radix UI](https://www.radix-ui.com/) - 無障礙 UI 元件
- [shadcn/ui](https://ui.shadcn.com/) - UI 設計系統
- [Tailwind CSS](https://tailwindcss.com/) - CSS 框架
- [Framer Motion](https://www.framer.com/motion/) - 動畫庫
