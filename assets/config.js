/*
 * 調查設定檔
 * 部署 Google Apps Script 後，把「網頁應用程式網址」貼到 apiUrl。
 * 部門、工具、用途、頻率、使用狀況的選項必須與 apps-script/Code.gs 一致。
 */
window.SURVEY_CONFIG = {
  // Google Apps Script 網頁應用程式網址（以 https://script.google.com/macros/s/ 開頭，結尾為 /exec）
  apiUrl: 'https://script.google.com/macros/s/AKfycbwT1rLHhl1KlA0e7mOpDp2l91DINaUCoJlCtXELzKFj4GPtvWk5BmqCGAgoSs2yaz9f2A/exec',

  companyZh: '八貫企業股份有限公司',
  companyEn: 'Cathay Consolidated, Inc',
  issuer: '資訊單位',
  contact: '如對本調查有任何疑問，請洽資訊單位。',
  // 填寫截止日，例如 '2026-12-15'；留空則不顯示
  deadline: '',

  departments: [
    '董事長室', '工程一部', '行政部', '品保一部', '業務部', '製造一部', '資材一部',
    '工程三部', '製造三部', '品保三部', '資材三部', '會計部', '財務部', '總經理室'
  ],

  tools: [
    { id: 'chatgpt', name: 'ChatGPT', vendor: 'OpenAI' },
    { id: 'claude', name: 'Claude', vendor: 'Anthropic' },
    { id: 'gemini', name: 'Gemini', vendor: 'Google' },
    { id: 'copilot', name: 'Microsoft 365 Copilot', vendor: 'Microsoft' }
  ],

  purposes: [
    '文書撰寫與潤飾', '翻譯', '資料分析與報表', '會議記錄與摘要',
    '簡報製作', '郵件與客戶溝通', '資料搜尋與查詢', '程式開發與自動化',
    '圖片與設計'
  ],

  frequencies: ['每天多次', '每天一次', '每週數次', '每週一次', '每月數次', '偶爾使用'],

  statuses: ['尚未使用', '使用中－免費版', '使用中－付費版'],

  // 「其他」工具最多可新增幾項
  maxOtherTools: 5
};
