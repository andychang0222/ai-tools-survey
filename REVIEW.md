# 雙 AI 協作審查板 (`REVIEW.md`)

此檔案為 **Claude Code** 與 **Antigravity（Gemini）** 的共用交辦與審查紀錄板。

---

## 專案狀態摘要
- **專案目錄**：`ai-tools-survey`
- **用途**：八貫企業股份有限公司（Cathay Consolidated, Inc）員工 AI 工具需求調查
- **架構**：GitHub Pages 靜態網頁（`index.html` 填答、`admin.html` 統計）＋ Google Apps Script（`apps-script/Code.gs`）寫入 Google 試算表
- **GitHub**：`andychang0222/ai-tools-survey`

---

## 進行中
### 第 2 版：問卷內容重新設計＋視覺改版（Claude Code，2026-11-26）
使用者回饋：第一版只問「需不需要」，缺少現況、方案、付費、資料安全等導入與管制面向；外觀像釣魚網站。
- 受影響檔案：`assets/schema.js`（新）、`apps-script/server.gs`（新）、`apps-script/build.js`（新）、`apps-script/Code.gs`（改為自動產生）、`index.html`、`admin.html`、`assets/survey.js`、`assets/admin.js`、`assets/style.css`、`assets/config.js`、`assets/img/*`（新）、`README.md`
- ✅ 題目重新設計：4 區段、條件題（使用者／未使用者）、各工具方案／付費者／帳號／頻率、資料安全、需求與管理看法
- ✅ 題目與驗證規則集中在 `schema.js`，前後端共用；`build.js` 合併產生 `Code.gs`
- ✅ 視覺改版（frontend-design skill）：沿用官網品牌色與正式 Logo、官網已公開的大樓照片當主視覺、左側進度欄、手機版進度列
- ✅ 統計頁改版（dataviz skill）：單色橫條、敏感資料以警示色＋文字標籤、各工具方案表、部門概況、文字回饋
- ✅ Node 測試（驗證規則＋模擬試算表後端）與瀏覽器測試（桌機、390px 手機寬度）通過
- ⏭️ Gemini 審查：使用者表示簡單網頁不需送審，略過
- ✅ 推上 GitHub
- ✅ 使用者更新 Apps Script 為第 2 版並部署（2026-11-26）

### 第 3 版：移除「需求與期望」區段（Claude Code，2026-11-26）
使用者指示：只問現況，不讓員工許願。
- ✅ 移除希望提供的工具、預計頻率、希望用途、希望支援、管理方式看法、其他意見；標題改為「AI 工具使用現況調查」；schema 版本 3
- ✅ 後端「填答」表頭移除「希望公司提供」「其他意見」兩欄（舊表自動改名保留）；統計頁同步移除相關圖表
- ✅ Node 測試與瀏覽器測試通過；推上 GitHub
- ⬜ 使用者更新 Apps Script 為第 3 版 `Code.gs` 並部署新版本

## 待使用者完成
- ✅ 建立 Google 試算表、設定 `ADMIN_PASSWORD`、部署網頁應用程式、開啟 GitHub Pages（第 1 版）
- ⬜ 第 3 版：更新 Apps Script（步驟見 README「更新後端」）

---

## 待審查／交辦事項
_無_

---

## 審查意見
### Gemini 審查後端（2026-11-26，`Code.gs`、`common.js`）→ Claude 處理結果
1. [高] 管理密碼錯誤次數可被並發請求繞過、比對洩漏長度 → **已修**：`getDocumentLock()` 包住計數（與填答的 script lock 分開）；改用 SHA-256 後比對。
2. [高] 釋放鎖前未 `SpreadsheetApp.flush()` → **已修**。
3. [中] 覆蓋不留紀錄、以儲存格比對姓名可能因自動轉型失敗 → **已修**：覆蓋前寫入「歷史紀錄」；改用第 7 欄 JSON 比對；文字欄設純文字格式；`readResponses_` 依部門＋姓名去重。
4. [中] 其他工具可重複同名、姓名可只填單引號或非字串 → **已修**：其他工具去重且不可與內建同名（前後端都檢查）；`cleanText_` 拒收非字串；姓名需含文字。
5. [低] 公式注入未涵蓋全形字元 → **已修**：`sheetSafe_` 加入 `＝＋－＠'`。
6. [低] `callApi` 未檢查網址 → **已修**。

### Gemini 審查前端（2026-11-26，`survey.js`、`admin.js`）→ Claude 處理結果
1. [中] 「其他工具（合計）」混算人數與人次 → **已修**：新增 `personTool()`，一人多項其他工具合併為一筆（狀況取最高、頻率取最頻繁、用途聯集），表一、三、四一律以人數計。
2. [中] 登出與載入競態、密碼失效仍重送舊密碼 → **已修**：`reqSeq` 丟棄過期回應；密碼錯誤或鎖定時自動登出並清除密碼；空白密碼提示；閒置 30 分鐘自動登出。
3. [中] 姓名前端未檢查文字、殘留紅框 → **已修**：與後端相同用 `\p{L}` 檢查；每次檢查前清除錯誤標示。
4. [低] 熱力圖被總數欄壓低色階 → **已修**：`heatTable` 增加上色欄位範圍。
5. [低] 部門只取設定檔 → **已修**：`deptList()` 合併資料中出現的部門，篩選、表二、排序都改用它。
6. [低] CSV 公式注入規則未對齊、BOM 為不可見字元 → **已修**：規則對齊後端；BOM 改用 `String.fromCharCode(0xFEFF)`。

---

## 完成紀錄
- ✅ 初版建置：填答頁、統計頁、Apps Script 後端；Node 模擬後端測試與瀏覽器模擬資料測試通過；依 Gemini 後端審查修正（`db18d71`）
- ✅ 依 Gemini 前端審查修正統計口徑、登出競態、前端驗證、熱力圖、部門清單、CSV（本次 commit）
