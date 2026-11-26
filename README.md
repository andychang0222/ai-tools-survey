# AI 工具使用需求調查

八貫企業股份有限公司（Cathay Consolidated, Inc）資訊單位內部調查網頁。

- `index.html`：同仁填答頁（部門、姓名、各 AI 工具的需求、用途、頻率、目前使用狀況：免費版／付費版）
- `admin.html`：統計頁（需輸入管理密碼）
- `apps-script/Code.gs`：Google Apps Script 後端，把填答寫進 Google 試算表

填答資料**只存在 Google 試算表**，不會放在 GitHub 上。同部門、同姓名重複填寫時，以最後一次為準。

---

## 部署步驟

### 1. 建立 Google 試算表與後端
1. 用公司的 Google 帳號建立一個新的 Google 試算表，命名例如「AI 工具需求調查」。
2. 點選單「擴充功能 → Apps Script」。
3. 把編輯器裡原本的程式全部刪掉，貼上本專案 `apps-script/Code.gs` 的內容，按儲存。
4. 左側「專案設定（齒輪）」→ 最下方「指令碼屬性」→「新增指令碼屬性」：
   - 屬性：`ADMIN_PASSWORD`
   - 值：統計頁的管理密碼（**至少 8 碼**，不要用自己的電腦或信箱密碼）
5. 回到編輯器，上方函式選單選 `setup`，按「執行」，依畫面完成授權。試算表會出現「填答」、「明細」、「歷史紀錄」三個工作表。
   （若「專案設定」裡有「啟用 Chrome V8 執行階段」的選項，請確認已勾選；新專案預設就是 V8。）

| 工作表 | 內容 |
|---|---|
| 填答 | 一人一列，同部門同姓名重填時覆蓋，以最後一次為準 |
| 明細 | 一人一工具一列，每次有人送出時自動重建，可做樞紐分析 |
| 歷史紀錄 | 被覆蓋前的舊資料，萬一有人誤填或冒名填寫可查回 |

### 2. 部署成網頁應用程式
1. 右上角「部署 → 新增部署作業」，類型選「網頁應用程式」。
2. 設定：
   - 執行身分：**我**
   - 誰可以存取：**所有人**（同仁不需登入 Google 即可填寫）
3. 按「部署」，複製「網頁應用程式網址」（`https://script.google.com/macros/s/.../exec`）。

### 3. 把網址填進網頁設定
編輯 `assets/config.js`，把網址貼到 `apiUrl`：

```js
apiUrl: 'https://script.google.com/macros/s/xxxxxxxx/exec',
```

需要的話也可以設定 `deadline`（截止日期）與 `contact`（聯絡方式）。改完推上 GitHub。

### 4. 開啟 GitHub Pages
GitHub repo →「Settings → Pages」→ Source 選「Deploy from a branch」，Branch 選 `main`、資料夾 `/ (root)`，按 Save。約 1 分鐘後網址為：

- 填答頁：`https://andychang0222.github.io/ai-tools-survey/`
- 統計頁：`https://andychang0222.github.io/ai-tools-survey/admin.html`

---

## 修改 Code.gs 之後
Apps Script 要「部署 → 管理部署作業 → 編輯（鉛筆）→ 版本選『新版本』→ 部署」，網址才會套用新程式，且網址不變。

## 修改選項（部門、工具、用途等）
`assets/config.js` 與 `apps-script/Code.gs` 開頭的清單**必須一致**，否則後端會拒收。調查開始後請勿改動既有選項的文字，否則統計會分成兩類。

修改 CSS／JS 後，請把 `index.html`、`admin.html` 裡的 `?v=1` 改成 `?v=2`，避免同仁瀏覽器用到舊檔。

## 統計方式
- 統計頁：依工具、部門、頻率、用途統計，可依部門篩選、搜尋姓名，並可匯出明細 CSV（Excel 可直接開啟）。
- 試算表「明細」工作表：一人一工具一列，可直接做樞紐分析。
- 管理密碼連續輸錯 8 次會暫停登入 15 分鐘。

## 安全說明
- 填答頁不收集帳號、密碼、員工編號，只收部門與姓名。
- 網頁不載入任何外部字型、圖片或第三方程式，並設定 Content-Security-Policy 只允許連到 Google Apps Script。
- 後端會檢查部門、工具與選項是否在允許清單內，並限制文字長度、防止試算表公式注入。
- 統計頁密碼只存在瀏覽器記憶體，關閉分頁即清除。
- 建議透過公司內部信件或公告發送網址，並註明發起單位，讓同仁確認來源。
