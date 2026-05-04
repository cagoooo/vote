# 安全政策 Security Policy

## 🔑 關於 Firebase Web API Key 出現在前端 bundle

如果您在 GitHub Secret Scanning、安全掃描工具或手動檢視 build 產物時，
看到形如 `AIzaSy...` 的 Google API Key，**這是 Firebase 的設計，不是資安漏洞**。

### 官方依據
根據 [Firebase 官方文件](https://firebase.google.com/docs/projects/api-keys)：
> "Firebase API keys are different from typical API keys...
>  it is OK for these to be publicly exposed."

Firebase Web SDK 必須在瀏覽器端用 API Key 識別專案，這把 key 在 `npm run build`
之後一定會出現在 `dist/public/assets/index-*.js` 內，無論是否從 env var 注入都一樣。
試圖把它藏起來（例如改用後端 proxy）對安全沒有幫助，反而徒增複雜度。

---

## 🛡️ 本專案的實際保護層

### ① HTTP Referrer 限制（GCP API Key 設定）
此 key 已限定只能從以下來源使用，外人拿到 key 在自己的網站呼叫會收到 403：

- `https://cagoooo.github.io/*`（含 `/vote/` 線上版）
- `https://vote-9db54.web.app/*` & `https://vote-9db54.firebaseapp.com/*`（Firebase Hosting 備案）
- `http://localhost/*` & `http://127.0.0.1/*`（本地開發）

### ② API Restrictions（GCP API Key 設定）
只允許呼叫 Firebase 必要服務（Firestore、Auth、Hosting、Installations、Storage、
App Check、Realtime DB 等），**未啟用**任何會噴錢的收費 API：
- ❌ Maps / Places / Geocoding
- ❌ Translate / Vision / Speech
- ❌ YouTube Data
- ❌ Vertex AI / Generative Language

即使有人偽造合法 referrer 繞過 ①，也無法用這把 key 觸發任何收費 API。

### ③ Firestore Security Rules（owner-only）
[`firestore.rules`](firestore.rules) 強制：
- `questions` 文件只能被 `teacherId == request.auth.uid` 的擁有者修改
- `votes` 任何登入者可建立自己的票（`userId == request.auth.uid`），不可改、只有題目擁有者能刪
- 新建 question 必須帶齊欄位 schema，無法塞惡意資料

即使有人盜用 key + 合法 referrer 連到 Firestore，也只能讀（讀本來就公開）、
不能竄改別人的題目或票。

### ④ Firebase Auth Authorized Domains
Firebase Console → Authentication → Settings → Authorized domains 已限定登入來源
domain，外站無法用本專案的 key 跑 Auth flow。

---

## 🚨 處理 GitHub Secret Scanning Alert 的 SOP

未來若再收到同類 `Public leak` 警報：

1. **確認來源**：是否為 build 產物路徑（`dist/`、`assets/index-*.js`）或
   `client/src/lib/firebase.ts` 這種 Firebase 初始化檔
   → 是 → 幾乎可確定為 Firebase Web Key 設計性公開，繼續 SOP
   → 不是 → 真實洩漏，立刻 rotate
2. **驗證 GCP 限制仍存在**：
   ```bash
   gcloud services api-keys describe <KEY_RESOURCE_NAME> \
     --project=vote-9db54 --account=cagooo@gmail.com --format=yaml
   ```
   確認 `restrictions.browserKeyRestrictions.allowedReferrers` 與
   `restrictions.apiTargets` 都還在。
3. **Dismiss alert**：
   ```bash
   gh api -X PATCH repos/cagoooo/vote/secret-scanning/alerts/<N> \
     -f state=resolved \
     -f resolution=wont_fix \
     -f resolution_comment="Firebase Web API Key is public by design. See SECURITY.md."
   ```

---

## ❌ 絕對不要做

- **不要**用 `git filter-repo` / BFG 刪除歷史中的 key — key 早被搜尋引擎索引，
  毫無意義，反而會搞壞所有 collaborator 的 clone
- **不要**改成「後端 proxy fetch Firestore」— 複雜度遠超收益，業界沒人這樣做
- **不要**忽略 GCP API Key restrictions — 這才是真的漏洞（會被濫刷帳單）
- **不要**把 Service Account JSON / Firebase Admin SDK 私鑰 commit 到 repo —
  那種 key 才是真的需要嚴密保密，而且 GitHub Secret Scanning 對 SA key 同樣會
  發 alert，請務必嚴肅處理

---

## 📞 回報資安問題

若您發現本專案的真實資安漏洞（不是上述設計性公開的 Web API Key），
請透過以下管道私下回報，**請勿在 GitHub Issue 公開**：

- Email: ipad@mail2.smes.tyc.edu.tw

收到回報後會在 7 個工作天內回覆。
