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
### 初版建置（Claude Code）
- 受影響檔案：`index.html`、`admin.html`、`assets/*`、`apps-script/Code.gs`、`README.md`
- ✅ 填答頁（部門、姓名、四項工具＋其他工具、用途、頻率、使用狀況：免費／付費）
- ✅ Apps Script 後端（驗證輸入、部門＋姓名以最後一次為準、管理密碼查詢統計）；Node 模擬測試通過
- ✅ 統計頁（密碼登入、依工具／部門／頻率／用途統計、明細、匯出 CSV）；瀏覽器模擬資料測試通過
- ✅ Gemini 審查後端（`Code.gs`、`common.js`）：6 點全部採納修正（見下方審查意見）
- 🔄 Gemini 審查前端（`survey.js`、`admin.js`）
- 🔄 推上 GitHub

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

---

## 完成紀錄
_尚無。_
