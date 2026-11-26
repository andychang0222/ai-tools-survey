/**
 * 八貫企業股份有限公司 AI 工具使用需求調查：Google Apps Script 後端
 *
 * 部署方式：見專案 README.md
 * - 本程式需綁定在 Google 試算表上（試算表 → 擴充功能 → Apps Script）。
 * - 管理密碼存放在「專案設定 → 指令碼屬性」，屬性名稱 ADMIN_PASSWORD，不寫在程式碼裡。
 * - 下方選項必須與網頁 assets/config.js 一致。
 */

var DEPARTMENTS = [
  '董事長室', '工程一部', '行政部', '品保一部', '業務部', '製造一部', '資材一部',
  '工程三部', '製造三部', '品保三部', '資材三部', '會計部', '財務部', '總經理室'
];

var TOOLS = [
  { id: 'chatgpt', name: 'ChatGPT' },
  { id: 'claude', name: 'Claude' },
  { id: 'gemini', name: 'Gemini' },
  { id: 'copilot', name: 'Microsoft 365 Copilot' }
];

var PURPOSES = [
  '文書撰寫與潤飾', '翻譯', '資料分析與報表', '會議記錄與摘要',
  '簡報製作', '郵件與客戶溝通', '資料搜尋與查詢', '程式開發與自動化',
  '圖片與設計'
];

var FREQUENCIES = ['每天多次', '每天一次', '每週數次', '每週一次', '每月數次', '偶爾使用'];
var STATUSES = ['尚未使用', '使用中－免費版', '使用中－付費版'];
var MAX_OTHER_TOOLS = 5;

var SHEET_MAIN = '填答';
var SHEET_DETAIL = '明細';
var SHEET_HISTORY = '歷史紀錄';
var MAIN_HEADERS = ['最後更新時間', '首次填寫時間', '部門', '姓名', '需要的工具', '其他意見', '原始資料（請勿修改）'];
var DETAIL_HEADERS = ['最後更新時間', '部門', '姓名', '工具', '是否為其他工具', '用途', '其他用途', '使用頻率', '目前使用狀況'];
var COL_JSON = 7; // 原始資料欄位（第 7 欄）

// 管理密碼連續錯誤幾次後暫停登入、暫停幾秒
var MAX_LOGIN_FAILS = 8;
var LOCKOUT_SECONDS = 900;

/* ---------------- 進入點 ---------------- */

function doGet() {
  return ContentService.createTextOutput('AI 工具使用需求調查：資料接收服務運作中。');
}

function doPost(e) {
  var req;
  try {
    req = JSON.parse(e && e.postData && e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: '資料格式錯誤' });
  }
  if (!req || typeof req !== 'object') return json_({ ok: false, error: '資料格式錯誤' });

  try {
    if (req.action === 'submit') return json_(handleSubmit_(req.data));
    if (req.action === 'stats') return json_(handleStats_(req.password));
    return json_({ ok: false, error: '不支援的操作' });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: '伺服器忙碌，請稍後再試' });
  }
}

/* ---------------- 填答 ---------------- */

function handleSubmit_(raw) {
  if (!raw || typeof raw !== 'object') return { ok: false, error: '資料格式錯誤' };

  // 防機器人隱藏欄位：有值就假裝成功，但不寫入
  if (raw.website) return { ok: true, updated: false, time: new Date().toISOString() };

  var v = validate_(raw);
  if (v.error) return { ok: false, error: v.error };
  var data = v.data;

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, error: '目前填答人數較多，請稍後再送出一次' };
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var main = ensureSheet_(ss, SHEET_MAIN, MAIN_HEADERS);
    var now = new Date();
    var key = personKey_(data.dept, data.name);

    // 以第 7 欄原始資料（JSON）比對部門＋姓名，避免儲存格被試算表自動轉型而比對失敗
    var lastRow = main.getLastRow();
    var foundRow = -1;
    var oldRow = null;
    var firstTime = now.toISOString();
    if (lastRow > 1) {
      var vals = main.getRange(2, 1, lastRow - 1, COL_JSON).getValues();
      for (var i = 0; i < vals.length; i++) {
        var old = parseJson_(vals[i][COL_JSON - 1]);
        if (old && personKey_(old.dept, old.name) === key) {
          foundRow = i + 2;
          oldRow = vals[i];
          if (old.firstTime) firstTime = old.firstTime;
          break;
        }
      }
    }

    data.time = now.toISOString();
    data.firstTime = firstTime;

    var neededNames = data.tools.filter(function (t) { return t.need; }).map(function (t) { return t.name; });
    var row = [
      now,
      new Date(firstTime),
      data.dept,
      sheetSafe_(data.name),
      sheetSafe_(neededNames.join('、') || '（無）'),
      sheetSafe_(data.comment),
      JSON.stringify(data)
    ];

    if (foundRow > 0) {
      // 覆蓋前把舊資料留到「歷史紀錄」，被誤填或冒名覆蓋時可以追查還原
      ensureSheet_(ss, SHEET_HISTORY, MAIN_HEADERS).appendRow(oldRow);
      main.getRange(foundRow, 1, 1, row.length).setValues([row]);
    } else {
      main.appendRow(row);
    }

    rebuildDetail_(ss, main);
    SpreadsheetApp.flush(); // 釋放鎖之前確實寫入，避免下一筆讀到舊資料
    return { ok: true, updated: foundRow > 0, time: data.time };
  } finally {
    lock.releaseLock();
  }
}

function validate_(raw) {
  var dept = cleanText_(raw.dept, 20);
  if (DEPARTMENTS.indexOf(dept) < 0) return { error: '請選擇正確的部門' };

  var name = cleanText_(raw.name, 20);
  // 姓名至少要有一個文字（中英文字母），擋掉只有符號、單引號的輸入
  if (!/[\p{L}]/u.test(name)) return { error: '請填寫姓名' };

  var comment = cleanText_(raw.comment, 500, true);

  if (!Array.isArray(raw.tools) || raw.tools.length > TOOLS.length + MAX_OTHER_TOOLS) {
    return { error: '工具資料格式錯誤' };
  }

  var tools = [];
  var seen = {};
  var otherCount = 0;

  for (var i = 0; i < raw.tools.length; i++) {
    var t = raw.tools[i];
    if (!t || typeof t !== 'object') return { error: '工具資料格式錯誤' };
    var out;

    if (t.other === true) {
      otherCount++;
      if (otherCount > MAX_OTHER_TOOLS) return { error: '其他工具最多 ' + MAX_OTHER_TOOLS + ' 項' };
      var otherName = cleanText_(t.name, 40);
      if (!otherName) return { error: '請填寫其他工具的名稱' };
      var otherKey = toolNameKey_(otherName);
      for (var b = 0; b < TOOLS.length; b++) {
        if (toolNameKey_(TOOLS[b].name) === otherKey) return { error: otherName + ' 已列在上方工具中，請直接在上方選擇' };
      }
      if (seen['other:' + otherKey]) return { error: '其他工具「' + otherName + '」重複填寫' };
      seen['other:' + otherKey] = true;
      out ={ id: 'other', name: otherName, other: true, need: true };
    } else {
      var def = findTool_(t.id);
      if (!def) return { error: '工具資料格式錯誤' };
      if (seen[def.id]) return { error: '工具資料重複' };
      seen[def.id] = true;
      out = { id: def.id, name: def.name, other: false, need: t.need === true };
      if (!out.need) { tools.push(out); continue; }
    }

    var detail = validateDetail_(t, out.name);
    if (detail.error) return detail;
    out.purposes = detail.purposes;
    out.purposeOther = detail.purposeOther;
    out.frequency = detail.frequency;
    out.status = detail.status;
    tools.push(out);
  }

  for (var k = 0; k < TOOLS.length; k++) {
    if (!seen[TOOLS[k].id]) return { error: '請回答 ' + TOOLS[k].name + ' 是否需要' };
  }

  return { data: { dept: dept, name: name, comment: comment, tools: tools } };
}

function validateDetail_(t, label) {
  if (!Array.isArray(t.purposes) || t.purposes.length > PURPOSES.length) return { error: label + '：用途資料錯誤' };
  var purposes = [];
  for (var i = 0; i < t.purposes.length; i++) {
    var p = cleanText_(t.purposes[i], 30);
    if (PURPOSES.indexOf(p) < 0) return { error: label + '：用途資料錯誤' };
    if (purposes.indexOf(p) < 0) purposes.push(p);
  }
  var purposeOther = cleanText_(t.purposeOther, 50);
  if (!purposes.length && !purposeOther) return { error: label + '：請至少勾選一項用途' };

  var frequency = cleanText_(t.frequency, 20);
  if (FREQUENCIES.indexOf(frequency) < 0) return { error: label + '：請選擇使用頻率' };

  var status = cleanText_(t.status, 20);
  if (STATUSES.indexOf(status) < 0) return { error: label + '：請選擇目前使用狀況' };

  return { purposes: purposes, purposeOther: purposeOther, frequency: frequency, status: status };
}

// 依「填答」工作表重建「明細」工作表（一人一工具一列，方便樞紐分析）
function rebuildDetail_(ss, main) {
  var detail = ensureSheet_(ss, SHEET_DETAIL, DETAIL_HEADERS);
  var rows = [];
  readResponses_(main).forEach(function (r) {
    r.tools.forEach(function (t) {
      if (!t.need) return;
      rows.push([
        new Date(r.time),
        r.dept,
        sheetSafe_(r.name),
        sheetSafe_(t.name),
        t.other ? '是' : '否',
        (t.purposes || []).join('、'),
        sheetSafe_(t.purposeOther || ''),
        t.frequency,
        t.status
      ]);
    });
  });

  var last = detail.getLastRow();
  if (last > 1) detail.getRange(2, 1, last - 1, DETAIL_HEADERS.length).clearContent();
  if (rows.length) detail.getRange(2, 1, rows.length, DETAIL_HEADERS.length).setValues(rows);
}

/* ---------------- 統計（需管理密碼） ---------------- */

function handleStats_(password) {
  var props = PropertiesService.getScriptProperties();
  var adminPw = props.getProperty('ADMIN_PASSWORD');
  if (!adminPw || adminPw.length < 8) {
    return { ok: false, error: '尚未設定管理密碼（指令碼屬性 ADMIN_PASSWORD，至少 8 碼）' };
  }

  // 用文件鎖（與填答用的指令碼鎖分開）讓「讀取錯誤次數 → 比對 → 累加」不被並發請求繞過，
  // 有人猜密碼時也不會卡住同仁送出問卷
  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(10000)) return { ok: false, error: '系統忙碌，請稍後再試' };
  var passed = false;
  var lockedOut = false;
  try {
    var cache = CacheService.getScriptCache();
    var fails = Number(cache.get('admin_fails') || 0);
    if (fails >= MAX_LOGIN_FAILS) {
      lockedOut = true;
    } else if (typeof password === 'string' && password.length <= 200 && safeEqual_(password, adminPw)) {
      passed = true;
    } else {
      cache.put('admin_fails', String(fails + 1), LOCKOUT_SECONDS);
    }
  } finally {
    lock.releaseLock();
  }

  if (lockedOut) return { ok: false, error: '密碼錯誤次數過多，請 15 分鐘後再試' };
  if (!passed) {
    Utilities.sleep(800);
    return { ok: false, error: '密碼錯誤' };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var main = ensureSheet_(ss, SHEET_MAIN, MAIN_HEADERS);
  return { ok: true, time: new Date().toISOString(), responses: readResponses_(main) };
}

// 讀出所有有效填答；萬一同一人有多列（例如手動貼上），只取最後更新的一筆
function readResponses_(main) {
  var last = main.getLastRow();
  if (last < 2) return [];
  var vals = main.getRange(2, 1, last - 1, COL_JSON).getValues();
  var byKey = {};
  var order = [];
  vals.forEach(function (row) {
    var d = parseJson_(row[COL_JSON - 1]);
    if (!d || !d.dept || !d.name || !Array.isArray(d.tools)) return; // 被手動改壞的列直接略過
    var k = personKey_(d.dept, d.name);
    if (!byKey[k]) order.push(k);
    if (!byKey[k] || String(d.time) > String(byKey[k].time)) byKey[k] = d;
  });
  return order.map(function (k) { return byKey[k]; });
}

/* ---------------- 工具函式 ---------------- */

function ensureSheet_(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    // 文字欄位設為純文字，避免姓名被自動轉成數字或日期（第 1、2 欄為時間）
    sh.getRange(1, 3, sh.getMaxRows(), headers.length - 2).setNumberFormat('@');
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function parseJson_(s) {
  if (typeof s !== 'string' || s.charAt(0) !== '{') return null;
  try { return JSON.parse(s); } catch (err) { return null; }
}

// 其他工具名稱比對用：去除空白、轉小寫
function toolNameKey_(s) {
  return String(s).replace(/\s+/g, '').toLowerCase();
}

function findTool_(id) {
  for (var i = 0; i < TOOLS.length; i++) if (TOOLS[i].id === id) return TOOLS[i];
  return null;
}

// 去除控制字元、合併空白、限制長度
function cleanText_(s, max, multiline) {
  if (typeof s !== 'string') return '';
  if (multiline) {
    s = s.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
  } else {
    s = s.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ');
  }
  return s.trim().slice(0, max);
}

// 姓名比對用：去除所有空白、英文轉小寫
function personKey_(dept, name) {
  return String(dept).trim() + '|' + String(name).replace(/^'/, '').replace(/\s+/g, '').toLowerCase();
}

// 防止試算表公式注入：開頭是 = + - @（含全形）或單引號的文字前面加上單引號
function sheetSafe_(s) {
  s = String(s || '');
  return /^[=+\-@＝＋－＠']/.test(s) ? "'" + s : s;
}

// 先轉成固定長度的 SHA-256 再比對，不因長度不同而提早結束
function safeEqual_(a, b) {
  var ha = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, a, Utilities.Charset.UTF_8);
  var hb = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, b, Utilities.Charset.UTF_8);
  var diff = 0;
  for (var i = 0; i < ha.length; i++) diff |= ha[i] ^ hb[i];
  return diff === 0;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* 部署前可在編輯器中手動執行一次，建立工作表並授權 */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, SHEET_MAIN, MAIN_HEADERS);
  ensureSheet_(ss, SHEET_DETAIL, DETAIL_HEADERS);
  ensureSheet_(ss, SHEET_HISTORY, MAIN_HEADERS);
  var pw = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  console.log(pw && pw.length >= 8 ? '工作表已建立，管理密碼已設定。' : '工作表已建立。請到「專案設定 → 指令碼屬性」新增 ADMIN_PASSWORD（至少 8 碼）。');
}
