# AI 工具使用現況與需求調查

八貫企業股份有限公司（Cathay Consolidated, Inc）資訊單位內部問卷。

- 填答頁：https://andychang0222.github.io/ai-tools-survey/
- 統計頁：https://andychang0222.github.io/ai-tools-survey/admin.html （需管理密碼，網址不要發給同仁）

填答資料**只存在 Google 試算表**，不會放在 GitHub 上。同部門、同姓名重複填寫時以最後一次為準，舊資料移到「歷史紀錄」工作表。

## 問卷內容（第 2 版）

| 區段 | 題目 | 誰會看到 |
|---|---|---|
| 1 基本資料 | 部門、姓名、職務（主管／非主管）、工作中使用電腦的時間 | 全部 |
| 2 使用現況 | AI 熟悉程度、目前使用情況 | 全部 |
| | 沒有使用或停用的原因 | 未使用者 |
| | 使用哪些工具；每項工具的方案、費用由誰支付（付費方案才問）、登入帳號、使用頻率 | 使用者 |
| | 使用裝置、目前用途、實際例子、每週節省時間 | 使用者 |
| 3 資料安全 | 曾輸入的資料類型、是否知道 AI 會保存或訓練對話、是否查核產出 | 使用者 |
| 4 需求與期望 | 希望公司提供的工具、預計頻率、希望 AI 協助的工作、需要的支援、對管理方式的看法、其他意見 | 全部 |

## 檔案結構

| 檔案 | 用途 |
|---|---|
| `index.html`、`assets/survey.js` | 填答頁 |
| `admin.html`、`assets/admin.js` | 統計頁 |
| `assets/schema.js` | **題目、選項與驗證規則**（填答頁與後端共用） |
| `assets/config.js` | 網站設定：後端網址、公司名稱、截止日期、聯絡方式 |
| `apps-script/server.gs` | 後端主程式 |
| `apps-script/Code.gs` | **貼到 Google Apps Script 的檔案**（由 `build.js` 自動產生，不要直接改） |
| `apps-script/build.js` | 把 `schema.js` 和 `server.gs` 合併成 `Code.gs` |

## 修改題目

1. 編輯 `assets/schema.js`。
2. 把 `version` 加 1（例如 2 → 3），舊版網頁送出時會被要求重新整理，避免新舊資料混在一起。
3. 執行 `node apps-script/build.js` 產生新的 `Code.gs`。
4. 把 `index.html`、`admin.html` 裡的 `?v=4` 改成下一個數字，避免同仁瀏覽器用到舊檔。
5. 推上 GitHub，並依下方「更新後端」把新的 `Code.gs` 部署到 Apps Script。

調查開始後請不要改既有選項的文字，否則統計會分成兩類。

## 更新後端（每次 Code.gs 有變動都要做）

1. 打開試算表 →「擴充功能 → Apps Script」。
2. 打開 https://raw.githubusercontent.com/andychang0222/ai-tools-survey/main/apps-script/Code.gs ，`Ctrl + A`、`Ctrl + C` 複製。
3. 回到 Apps Script，點 `程式碼.gs`，`Ctrl + A` 後 `Ctrl + V` 貼上，`Ctrl + S` 儲存。
4. 上方函式選單選 `setup`，按「執行」。表頭和新版不同的舊工作表會自動改名為「（舊版 日期）」保留，並建立新的工作表。
5. 右上角「部署 → 管理部署作業」→ 點目前部署右邊的鉛筆圖示 →「版本」選 **新版本** → 按「部署」。網址不會變。
6. 打開後端網址，看到「資料接收服務運作中（第 2 版）」就完成了。

## 第一次建立後端

1. 用公司 Google 帳號開新的試算表（https://sheets.new ），選「擴充功能 → Apps Script」。
2. 依「更新後端」第 2、3 步貼上 `Code.gs`。
3. 左側齒輪「專案設定」→「指令碼屬性」→ 新增 `ADMIN_PASSWORD`（統計頁密碼，至少 8 碼）。
4. 執行 `setup` 並完成授權（出現「Google 尚未驗證這個應用程式」時按「進階 → 前往」）。
5. 「部署 → 新增部署作業」→ 類型選「網頁應用程式」，執行身分選「我」，存取權選「所有人」→ 部署，複製網址。
6. 把網址填進 `assets/config.js` 的 `apiUrl`，推上 GitHub。
7. GitHub repo →「Settings → Pages」→ Branch 選 `main`、`/ (root)` → Save。

## 試算表工作表

| 工作表 | 內容 |
|---|---|
| 填答 | 一人一列，最後一欄是完整的原始資料（JSON），請勿修改 |
| 工具使用明細 | 一人一工具一列（方案、是否付費、誰付費、登入帳號、頻率），每次有人送出時自動重建，可做樞紐分析 |
| 歷史紀錄 | 被覆蓋前的舊資料，萬一有人誤填或冒名填寫可查回 |

統計頁可依部門篩選，並可匯出 CSV（一人一列、所有題目各一欄，Excel 可直接開啟）。

## 安全說明

- 填答頁只收部門與姓名，不收帳號、密碼、員工編號。
- 網頁不載入任何外部程式、字型或圖片，Content-Security-Policy 只允許連到 Google Apps Script。
- 後端以 `schema.js` 的同一套規則重新檢查所有資料：只接受清單內的選項、限制文字長度、隱藏題一律清空、防止試算表公式注入。
- 統計頁密碼只存在瀏覽器記憶體；閒置 30 分鐘自動登出；密碼連錯 8 次暫停 15 分鐘。
- 頁首照片與 Logo 取自公司官網已公開的素材。
