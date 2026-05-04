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

#### P1-5. Firestore 收費監控與告警
- 在 GCP Console 設預算告警（$1 / $5 / $10）
- 加 BigQuery export → 看每天 read/write 用量趨勢
- 每月免費額度：50K read / 20K write / 1GB storage，正常教學量不會爆

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

#### P2-3. 學生身份識別（選填）
- 老師建題時可勾「需具名」
- 學生第一次投票要填「姓名 + 座號」（存在 localStorage）
- 老師結果頁顯示「誰投了什麼」
- 用於形成性評量／補救教學

#### P2-4. 即時表情反饋
- 學生端常駐 5 顆表情按鈕（👍 😮 🤔 ❓ 🎉）
- 點擊後在老師大螢幕上飛過去（彈幕風格）
- 不存資料庫只用 Realtime DB ephemeral channel，避免炸成本

#### P2-5. 教師「課堂模式」全螢幕投影
- 一個專門的 `/present/:id` 路徑
- 隱藏所有控制按鈕，只剩題目 + 大字票數 + QR
- F11 全螢幕看起來最專業
- 加倒數計時器（30 秒投票時間）

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

#### TD-1. 砍掉沒在用的後端
- `server/` 整個目錄、`server/storage.ts` 的 `MemStorage`、`drizzle.config.ts`、`shared/schema.ts` 都是早期 Express + PostgreSQL 架構的遺跡
- 現在前端直接用 Firestore，後端零參與
- 砍掉可以縮小 repo、減少新人困惑、`npm install` 也快很多

#### TD-2. 砍掉 `localVoting.ts`
- `client/src/lib/localVoting.ts` 應該是 GitHub Pages 純前端模式的 fallback，但實際上現在無論哪個環境都直連 Firestore
- 確認沒人 import 後刪掉

#### TD-3. 更新 `replit.md`
- 內容停留在「Express + 記憶體儲存 + 1 秒 polling」的初代架構
- 現在實際上是「Firestore 直連 + onSnapshot 即時推送」，差異很大
- 建議直接刪除（這檔是 Replit 專用的，repo 早就沒在 Replit 上開發了）或大改

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
