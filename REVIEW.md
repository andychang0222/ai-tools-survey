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
_目前無進行中任務。_

## 待使用者完成
- ✅ 建立 Google 試算表、貼上 `Code.gs`、設定 `ADMIN_PASSWORD`、部署網頁應用程式（2026-11-26，GET／POST 連線測試正常）
- ✅ 部署網址已填入 `assets/config.js` 的 `apiUrl` 並推送
- ⬜ GitHub repo → Settings → Pages 開啟（main / root）

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
