# 🗳️ 即時投票系統：詳細使用手冊 (USAGE)

本手冊將引導您如何高效使用這套專為教學環境設計的即時投票系統。

---

## 👨‍🏫 教師端：建立與管理投票

教師端是系統的核心，提供題目建立、圖片標註、即時統計等功能。

### 1. 準備題目圖片
進入首頁後，您有三種方式準備題目：
- **截圖上傳**：直接將圖片拖入區域，或使用 `Ctrl+V` 貼上剪貼簿內容。
- **白板繪製**：點擊「白板」按鈕，直接在網頁上繪製題目（支援多色畫筆）。
- **圖片標註**：上傳圖片後，點擊「標註」按鈕，在現有圖片上圈選重點。

### 2. 設定選項
- 在下方「選項設置」區域輸入選項文字。
- 點擊「添加選項」可增加更多選擇。
- 點擊選項旁的「垃圾桶」圖示可移除。

### 3. 發布投票
- 點擊「建立問題」按鈕。
- 系統會自動生成一個 **QR Code** 與 **專屬連結**。
- 將 QR Code 投影到大螢幕，或將連結傳送給學生。

### 4. 監控結果與揭曉答案
- **即時統計**：頁面會透過 Firebase Firestore 即時更新學生的投票分佈，無需重新整理。
- **設定答案**：在「正確答案管理」中點選正確的選項。
- **顯示答案**：點擊「顯示答案」，學生端的畫面上會同步顯示正確答案的標記。

---

## 🎓 學生端：參與投票

學生端追求極簡與快速，無需註冊即可參與。

### 1. 進入投票
- 使用手機掃描老師提供的 QR Code。
- 或點擊老師分享的連結。

### 2. 進行投票
- 檢視老師上傳的題目圖片。
- 點選您認為正確的選項。
- **注意**：系統會防止重複投票，每位學生僅能投一次。

### 3. 查看結果
- 投票後，您可以看到目前的即時統計圖表。
- 當老師揭曉答案時，您的畫面上會同步顯示正確選項。

---

## 🚀 GitHub 部署指南

如果您希望將此專案部署到自己的 GitHub，請參考以下建議：

### 方案 A：GitHub Pages + Firebase (推薦、全功能)
由於您已配置 Firebase，這是最佳選擇：
1. 修改 `vite.config.gh-pages.ts` 中的 `base` 為您的儲存庫名稱。
2. 執行 `npm run build:gh-pages`。
3. 將 `dist/public` 內容推送到 `gh-pages` 分支。
> **優點**：支援跨裝置即時同步，資料永久保存於 Firebase。

### 方案 B：Firebase Hosting
1. 執行 `firebase deploy` 即可完成部署。

---

## 🛠️ 技術支援與維護
- **重置投票**：若需重新開始，點擊教師端的「重置投票」。
- **清除資料**：若需徹底清除所有設定，點擊「重新建立問題」。

---

## 📅 開發進度紀錄

### 2026-05-04（凌晨 02 點） — P2-3 學生具名 + 倒數計時器 + footer 署名 ✅

**P2-3 學生具名（形成性評量）**：
- `question` schema 加 `requireIdentity?: boolean`，`vote` 加 `voterName?` `voterSeat?`（rules 限 30/10 字內）
- teacher 建題加「需要學生具名才能投票」checkbox（藍底虛線框 + 說明）
- student 端：`requireIdentity` 為 true 時先顯示身份表單（座號 + 姓名），autofocus 座號、確認後存 `localStorage` 跨題重用（key: `voter_name` / `voter_seat`）
- CSV 匯出自動偵測有具名就加「座號/姓名」欄位（無則維持匿名格式）

**倒數計時器**：
- `question` schema 加 `votingEndsAt?: Timestamp | null`
- 新函式 `startCountdown(id, seconds)` / `cancelCountdown(id)`
- teacher 結果頁加 amber 卡片：30/60/90 秒按鈕 + 取消倒數
- student 端：top center 浮動徽章顯示秒數，剩 ≤10 秒變紅 + pulse；倒數 0 顯示「⏰ 倒數結束」
- present 課堂模式：右側上方倒數圓圈大字（金 → 紅 → 黑漸變），剩 ≤10 秒整卡 pulse；秒數變化 spring 彈跳；歸零播 vote-start 音效

**阿凱老師 footer 署名**（套用 `akai-author-footer` skill）：
- 新元件 `site-footer.tsx`：「Made with ❤️ by 阿凱老師」連到中壢國小教師頁
- 在 App Router scope 內 mount，用 `useLocation` 偵測 route，`/present/*` 不渲染避免擋投影
- 加 `.no-print` + `@media print { display: none }` 避免 PDF 列印時看起來像自我宣傳

---

### 2026-05-04（凌晨） — 課堂模式 v2 增強 + P2-4 表情反饋 ✅ 已完成

**P2-5 v2 增強**（`/present/:id`）：
- 🔊 **聲音**：新票進來播 vote-submitted、第一名易主播 vote-start，頂部加靜音切換
- 🎉 **彩花特效**：第一名易主時觸發 `useConfetti` 五射煙火（4 秒冷卻 + 至少 2 票才算「超越」避免抖動）
- ✨ **動畫升級**：票數 spring scale + 變綠閃一下、編號圓圈 pop、進度條 layout 動畫
- 👑 **第一名標示**：金邊 ring + amber 漸層進度條 + 編號圓圈右上角 amber 皇冠徽章
- 顯示答案時優先用綠色高亮（覆蓋 top 樣式）

**P2-4 表情反饋（彈幕風格）**：
- 5 顆表情：👍 ❤️ 😮 🤔 🎉
- 學生端 `student.tsx` 底部固定膠囊狀按鈕列（白底毛玻璃）
- 點擊：spring scale + 旋轉動畫 + 寫入 Firestore `reactions/{id}`
- Client side debounce：每按鈕 1 秒冷卻，防洗版
- 課堂模式訂閱 30 秒內 reactions（onSnapshot），新表情從畫面下方飛上去 4 秒（左右輕飄、scale 1.4 → 1.2 → 1，旋轉 ±15°）
- 用 `useRef Set` 去重避免動畫重播

Firestore：reactions collection 新規則 + 新 composite index（`questionId+createdAt`），已部署。

---

### 2026-05-04（深夜） — P2-5 課堂模式 + TD-1 砍死後端 ✅ 已完成

**P2-5 全螢幕投影模式**（`/present/:id`）：
- 左 70% 大圖題目 + 即時票數動畫長條（每選項配獨立漸層色）
- 右 30% 大字房間代碼（藍底圓角 5xl）+ QR + 即時人數計數（紫漸層）
- 滑鼠靜止 3 秒自動隱藏控制列、cursor-none，乾淨投影體驗
- F11 / 自訂按鈕雙路徑切全螢幕，正確監聽 `fullscreenchange`
- 老師按「顯示答案」時對應選項 ring-4 green-400 + ✓ 圖示
- teacher 結果頁加紫邊「📺 課堂模式」按鈕（在 CSV 旁）

**TD-1 砍掉沒在用的 Express 後端**：
- 刪除 `server/`、`api/`、`shared/`、`drizzle.config.ts`、`vercel.json`、`build.sh`、`post-build.js`、`replit.md`、`DEPLOYMENT.md`
- `share-button.tsx` 改用本地 type 取代 `@shared/schema` import
- `package.json` 移除 16 個死依賴（express、drizzle、neon、passport、ws、tsx、esbuild、相關 `@types/*`）
- scripts 縮成 4 個：`dev` / `build` / `preview` / `check`
- node_modules 縮減 ~30%（700MB → 486MB），rebuild 速度 ↑
- repo 名稱從 `rest-express` 改為 `vote`，version 1.2.0
- `firebase functions/` 子專案獨立保留，不受影響

---

### 2026-05-04（夜間） — PWA + Service Worker 版本自動更新通知 ✅ 已完成

加入 `vite-plugin-pwa`（Vite + Workbox 官方推薦），prompt 模式：
- 偵測新版部署時，畫面底部顯示藍色浮動 banner「🚀 有新版可用」
- 「立即更新」按鈕呼叫 `updateServiceWorker(true)` 載入新版
- 60 分鐘 polling check + 頁面 load 時 check 雙重保險
- 用 prompt 而非 autoUpdate，避免：(1) 學生投票中無預警 reload (2) infinite reload 雷

**版本徽章**：左下角灰色小字 `v{date}-{git_hash}`，hover 顯示完整版本，從 vite.config + git 注入。

**PWA 設定**：三張 icon（192/512/180-apple）從 logo.png 縮出；`manifest.webmanifest` name=即時投票系統 / theme=#3B82F6；workbox precache static asset + Firestore/Auth runtime NetworkOnly。

**避雷**：dev mode SW disabled、dev config 也裝 plugin 讓 `virtual:pwa-register/react` 解析得到、`navigateFallback` 設 `/vote/index.html` 處理 SPA routing。

---

### 2026-05-04（晚間） — LINE 推播通知 + Flex 卡片 v2 ✅ 已完成

**動機**：老師希望即時知道「有沒有人在用我這套系統」、「題目自動失效了沒」，不用一直開瀏覽器盯。

**架構**：vote-9db54 升 Blaze（連 billing account `018D5A`「我的帳單帳戶」）→ Cloud Functions (asia-east1, nodejs22, 2nd gen)，asia-east1 → LINE Push API（共用阿凱老師既有的 Bot Channel `2008810864`）。

**實作**：
- `functions/src/index.ts`
  - **`onQuestionCreated`**：Firestore `questions/{id}` onCreate trigger → 推 LINE 卡片含房間代碼、選項預覽、投票連結 button
  - **`expireOldQuestions`**：每 15 分鐘 scheduled function → 掃 `active==true && expiresAt<=now` → 設 `active=false` + 推 LINE 卡片含總票數、最高票
- `functions/src/notify-line.ts`：Flex 卡片 helper，支援 hero 大字區 + sections（wrap text 不被截）+ uri action button + 失敗自動 fallback 純文字
- 兩個 secret 用 `node -e fs.writeFileSync + --data-file` 寫入 Secret Manager（避開 Windows pipe \n 雷 #1）

**Flex 卡片 v2 UI 優化**（v1 在手機上 label 被截成「房...」「投...」）：
- ✅ 房間代碼用 hero 區 size 3xl 粗體置中（藍底圓角）
- ✅ 選項用 wrap text 兩欄式 `1. A   2. B`，最多顯示 6 個
- ✅ footer 加 primary button「📲 開啟投票頁」取代裸 URL
- ✅ 移除沒人看得懂的 `teacherId`
- ✅ 失效卡片含「總票數」「最高票」+ button「📊 查看完整結果」

**部署小插曲**：
- 首次 deploy 撞到 Eventarc Service Agent IAM 傳播延遲（雷 #5）→ `--force` 重跑解決
- artifact registry cleanup policy 設 1 天，避免 container image 累積佔空間

**待你手動完成**（非必要、僅為財務安全）：
- 設 NT$30/月預算告警：到 [GCP Console Budget](https://console.cloud.google.com/billing/018D5A-238911-41B10B/budgets) 點「Create Budget」→ 限定 `vote-9db54` → 30 TWD/月 → 50%/90%/100% 告警 email。或啟用 `billingbudgets.googleapis.com` API 後讓我用 gcloud 自動建。
- 教學量級每月成本實際 < NT$1，預算告警是雙保險。

---

### 2026-05-04（傍晚） — P1-1 老師儀表板 ✅ 已完成

新頁面 `/dashboard`：
- **Login gate**：未 Google 登入顯示登入卡片，匿名用戶不開放（避免顯示空清單造成困惑）
- **卡片網格**：縮圖 + 選項預覽（最多 4 個，正解高亮藍底）+ 狀態 badge（進行中 / 已過期 / 已停用 / 已設答案）+ 票數 + 相對時間（「3 分鐘前 / 2 小時前 / 5 天前」）
- **重新啟用**：把自己其他 active 題關掉、自身設 active 並重置 `expiresAt = now + 4h`
- **刪除**：confirm 後同步移除 question 與其所有 votes（避免 orphan vote 累積）
- **查看**：導向 `/?q=<id>`，由 teacher 頁載入該題；載入後自動抹掉 query string 避免重整重複觸發

teacher.tsx 加「我的題目」按鈕（只給 Google 登入者）。

**順手修的潛在 bug**：原本 `App.tsx` 無條件呼叫 `loginAnonymously()`，理論上會在 Google session 重整時被覆蓋成匿名 user。改為 `onAuthStateChanged` 確認 user 為 null 才匿名登入。

**新增 composite index**：`teacherId ASC + createdAt DESC`（dashboard 列表查詢用），已部署。

---

### 2026-05-04（下午） — P0 四項補洞 ✅ 已完成

| 項目 | 狀態 | 說明 |
|---|---|---|
| **P0-1 清舊資料** | ✅ 完成 | `firebase firestore:delete questions --recursive` 與 `votes --recursive` 清空，新規則 schema 才不會被舊資料卡住 |
| **P0-2 題目自動失效** | ✅ 完成 | question 加 `expiresAt`（建題時 + 4 小時），學生端過期顯示「投票已結束」UI 並擋下 vote mutation |
| **P0-3 Google 登入** | ✅ 完成 | `firebase.ts` 加 `signInWithGoogle`（用 `linkWithPopup` 升級匿名 → Google，**保留 uid**，舊題擁有權不會斷）；teacher.tsx 加登入狀態列 + 登入/登出按鈕；學生端維持匿名不變 |
| **P0-4 Storage 規則** | ⏭️ N/A | 圖片是 base64 直接存 Firestore document 的 `imageUrl` 欄位，**沒用 Firebase Storage**，不需設規則。詳見下方註腳 |

**🔐 順手處理的緊急安全警報**：
- GitHub Secret Scanning #1（Google API Key public leak）已 dismiss 為 `wont_fix`
- 確認 GCP API Key 已有 HTTP referrer 限制（`cagoooo.github.io/*`、`vote-9db54.web.app/*`、localhost）+ API restrictions（只勾 Firebase 服務，無付費 API）
- 新增 [`SECURITY.md`](SECURITY.md) 記錄政策，未來同類 alert 直接照 SOP 處理

**⚠️ 使用者需要手動完成的最後一步**：
> 到 [Firebase Console → Authentication → Sign-in method](https://console.firebase.google.com/project/vote-9db54/authentication/providers) 啟用 **Google** provider（按 Enable → 選支援 email → 儲存）。**不啟用的話 Google 登入按鈕會跳 `auth/operation-not-allowed` 錯誤**。匿名登入和投票本身不受影響。

**📌 P0-4 為什麼是 N/A**：
專案的圖片處理流程（`screenshot-upload.tsx`、`whiteboard.tsx`）都是把 canvas `toDataURL('image/jpeg')` 變成 base64 字串後直接寫入 question 文件的 `imageUrl` 欄位。**潛在隱憂**：Firestore 單一文件硬上限 1 MB，題目圖片若沒壓縮可能會超過。`screenshot-upload.tsx` 已有 `compressImage` 邏輯，但白板/標註輸出未壓縮。**建議**（非 P0）：未來若遇「文件太大」錯誤，再評估遷移到 Firebase Storage 或加強壓縮。

---

### 2026-05-04（上午） — 多老師教室隔離（Phase 1）✅ 已完成

**動機**：原本全專案只有一個「目前活躍題目」，A 老師建題時會把 B 老師的題目踢成 inactive，且任何登入者都能改別人的題目／正確答案。多老師同時上課會嚴重互相干擾。

**已完成的改動**：

| 項目 | 檔案 | 說明 |
|---|---|---|
| Schema 加 `teacherId` | `client/src/lib/firestore-voting.ts` | `FirestoreQuestion` interface 新增 `teacherId: string` 欄位，建題時自動寫入 `auth.currentUser.uid` |
| `getActiveQuestion` 限定本人 | 同上 | 內部讀 uid 並加 `where("teacherId","==",uid)` 過濾，每位老師只看到自己的活躍題目 |
| `createQuestion` deactivate 限定本人 | 同上 | 建立新題只關掉「自己」的舊題，不再影響其他老師 |
| Firestore 規則 owner-only | `firestore.rules` | questions 只有 owner 能 update/delete；votes 任何人能 create 自己的票，但只有該題 owner 能 delete（用於 resetVotes） |
| 新 composite index | `firestore.indexes.json` | 新增 `active + teacherId + createdAt desc` 三欄複合索引 |
| Firebase 專案連結 | `.firebaserc` | default = `vote-9db54`（cagooo@gmail.com 帳號） |

**部署狀態**：
- ✅ Firestore rules 已部署上線
- ✅ Firestore indexes 已部署上線
- ⚠️ **前端程式碼尚未 build / push** — 需執行 `npm run build:gh-pages` 並推到 `gh-pages` 分支才會在線上生效

**剩餘風險（待處理）**：
1. 既有舊題目沒有 `teacherId` 欄位，在新規則下無法被 update/delete。建議到 Firestore Console 整批清除 `questions` collection 內舊資料，或執行一次性 backfill script 補欄位。
2. 目前老師身份是 Firebase **匿名登入**，清掉瀏覽器資料就會變成「新老師」，看不到自己舊題。Phase 2 會升級為 Google 登入（見下方 P0-3）。

---

## 🚀 未來優化建議與技術藍圖

依優先級分組，從「補洞」到「擴功能」。

### ✅ 🔴 P0 全數完成（2026-05-04）

P0-1 / P0-2 / P0-3 / P0-4 已全部完成，詳見上方 2026-05-04 進度紀錄。以下保留原始建議內容供日後對照。

---

#### ✅ P0-1. 舊資料 backfill / 清除
**問題**：Phase 1 部署後，沒有 `teacherId` 的舊 question 文件變成「孤兒」，無法被任何人改/刪。
**做法**（任選）：
- **A 案（簡單）**：到 [Firestore Console](https://console.firebase.google.com/project/vote-9db54/firestore) 直接刪掉 `questions` 內所有舊資料。
- **B 案（保留歷史）**：寫一支 admin script，用 firebase-admin SDK 把所有 `teacherId` 不存在的文件補上你的 uid。

**建議**：教學投票題本來就是用過即丟，A 案最省事。

#### ✅ P0-2. 題目自動失效機制
**問題**：老師關閉瀏覽器後 question 仍 `active=true`，遲到的學生掃 QR 還是能投，且老師端再次開啟會看到「沒下課」的舊題。
**做法**：
- 在 question 文件加 `expiresAt` timestamp（例如建題時 + 4 小時）
- 學生端 `listenToQuestion` 收到後先比對 `expiresAt`，過期就顯示「投票已結束」
- 或加 Cloud Function 用 scheduler 每小時把過期的 `active` 改 false

#### ✅ P0-3. 升級匿名登入 → Google 登入
**問題**：匿名 uid 跟瀏覽器綁，換裝置／清 cookie 就變成新老師，舊題永遠找不回來。
**做法**：
- `firebase.ts` 改用 `signInWithPopup(GoogleAuthProvider)`
- 老師端首頁加「用 Google 登入」按鈕
- 學生端維持匿名（學生不用登入體驗才順）
- 規則不用改，uid 概念一樣

**好處**：老師換電腦也能繼續看自己的歷史題目；為 P1-1（老師儀表板）鋪路。

#### ⏭️ P0-4. Storage 規則同步加 owner 限制（N/A）
**已確認**：本專案完全沒用 Firebase Storage，圖片是 base64 直接塞 Firestore document。本項不需執行。

---

### 🟡 P1 中期想做（讓多老師體驗完整）

#### ✅ P1-1. 老師儀表板 / 歷史題庫（已完成 2026-05-04）
詳見上方進度紀錄。

#### P1-2. 房間代碼 / Room Code
- 建題時自動生成 4-6 碼短碼（如 `K3X7`），存在 question 文件
- 學生可以掃 QR **或** 到 `/join` 輸入代碼進入投票
- 對教學現場很實用：投影機壞掉、學生手機相機差時的備案

#### P1-3. CSV / Excel 匯出
- 老師端「結果頁」加「匯出」按鈕
- 內容：選項、票數、百分比、是否為正解、各 vote 的時間戳
- 用前端 CSV 生成（不用後端）：`papaparse` 或手刻 + `Blob` download

#### P1-4. resetVotes 改用 Cloud Function 批次刪
**現狀問題**：`firestore-voting.ts` 的 `resetVotes` 是 client side 一筆一筆 `deleteDoc`，30 票要 30 次 round trip + 30 次 rules 計費（rules 內還有 `get()` 查 owner 又多一次 read）。
**做法**：寫一支 callable Cloud Function `resetVotes(questionId)`，用 admin SDK 在後端 `bulkWriter` 批次刪，前端只發一個 RPC。

**優先級**：教學量級（一題 30 人）其實不痛，量大或對成本敏感再做。

#### ✅ P1-5. Firestore 收費監控與告警（已完成 2026-05-04，使用者手動）

---

### 🟢 P2 長期想做（功能擴充）

#### P2-1. 進階題型
- **多選題**：選項從 radio 變 checkbox，vote 文件 `optionIndex` 改 `optionIndices: number[]`
- **排序題**：學生拖曳排序，計分算 Spearman correlation
- **簡答題**：text input，老師端可以即時看到所有答案 word cloud
- **是非題**：簡化版單選

#### P2-2. PWA / 安裝到桌面
- 加 `manifest.json` + service worker
- 學生端可「安裝為 App」，下次直接從桌面開
- 注意 PWA cache bust 坑（參考 `pwa-cache-bust` skill）

#### ✅ P2-3. 學生身份識別（已完成 2026-05-04）
詳見上方進度紀錄。CSV 匯出含座號/姓名，老師端結果頁稍後可加「誰投了什麼」即時 list（目前需匯出 CSV 查看）。

#### ✅ P2-4. 即時表情反饋（已完成 2026-05-04）
詳見上方進度紀錄。實作用 Firestore reactions collection（client debounce + 30 秒查詢窗口控成本）。

#### ✅ P2-5. 教師「課堂模式」全螢幕投影（已完成 2026-05-04）
詳見上方進度紀錄。倒數計時器留待後續加。

#### P2-6. Cloudflare Turnstile 防 bot 灌票
- 適用情境：題目連結被學生分享出去到外面群組，被刷票
- 學生端投票前過一次 Turnstile（無感）
- 參考 `cloudflare-turnstile-integration` skill

#### P2-7. 課程 / 班級分組
- 老師可建「班級」（如 503、504），題目歸屬到班級
- 同一個老師可以分別查 503 vs 504 的數據
- Schema：新增 `classes` collection + question 加 `classId` 欄位

---

### 📐 技術債清理（順手做）

#### ✅ TD-1. 砍掉沒在用的後端（已完成 2026-05-04）
詳見上方進度紀錄。

#### TD-2. 砍掉 `localVoting.ts`
- `client/src/lib/localVoting.ts` 應該是 GitHub Pages 純前端模式的 fallback，但實際上現在無論哪個環境都直連 Firestore
- 確認沒人 import 後刪掉

#### ✅ TD-3. 更新 `replit.md`（已完成 2026-05-04，於 TD-1 一併刪除）

#### TD-4. CI/CD 自動化部署
- 目前每次改前端要手動 `build:gh-pages` + 推 `gh-pages` 分支
- 加 `.github/workflows/deploy.yml`，push to main 自動 build + deploy GitHub Pages
- Firestore rules / indexes 改動也加自動部署：用 `FIREBASE_TOKEN` secret + `firebase deploy --only firestore`

---

## 📋 建議的執行順序

如果照優先級一條條做，建議這個順序：

1. **本週**：P0-1（清舊資料）+ build & push 前端 → Phase 1 才算真正上線
2. **下週**：P0-3（Google 登入）→ 解決匿名身份不穩的根本問題
3. **下下週**：P1-1（老師儀表板）→ 多老師體驗完整成形
4. **有空再做**：TD-1 / TD-3（清技術債）+ P1-3（CSV 匯出，老師會很愛）
5. **想擴功能時**：P2 任挑一個

> 💡 提醒：每完成一個項目就回頭更新本文件的「開發進度紀錄」段落，方便未來自己對照。
