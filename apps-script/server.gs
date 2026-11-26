/* ================================================================
 * 後端主程式（試算表寫入、統計查詢）
 * 題目與驗證規則在上方 SurveySchema（來源：assets/schema.js）
 * ================================================================ */

var SHEET_MAIN = '填答';
var SHEET_TOOLS = '工具使用明細';
var SHEET_HISTORY = '歷史紀錄';
var MAIN_HEADERS = ['最後更新時間', '首次填寫時間', '部門', '姓名', '職務', '使用情況', '目前使用的工具', '原始資料（請勿修改）'];
var TOOL_HEADERS = ['最後更新時間', '部門', '姓名', '工具', '方案', '是否付費', '費用支付', '登入帳號', '使用頻率'];
var COL_JSON = MAIN_HEADERS.length;

var MAX_LOGIN_FAILS = 8;
var LOCKOUT_SECONDS = 900;

/* ---------------- 進入點 ---------------- */

function doGet() {
  return ContentService.createTextOutput('AI 工具使用現況調查：資料接收服務運作中（第 ' + SurveySchema.version + ' 版）。');
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
  if (raw.website) return { ok: true, updated: false, time: new Date().toISOString() }; // 防機器人欄位
  if (raw.schemaVersion !== SurveySchema.version) {
    return { ok: false, error: '問卷已更新，請重新整理網頁（按 F5）後再填寫' };
  }

  var v = SurveySchema.validate(raw);
  if (v.errors.length) return { ok: false, error: v.errors[0].msg };
  var data = v.data;

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, error: '目前填答人數較多，請稍後再送出一次' };
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var main = ensureSheet_(ss, SHEET_MAIN, MAIN_HEADERS);
    var now = new Date();
    var key = personKey_(data.dept, data.name);

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
    data.schemaVersion = SurveySchema.version;

    var toolText = data.tools.map(function (t) { return t.name + '（' + t.plan + '）'; }).join('、');
    var row = [
      now,
      new Date(firstTime),
      data.dept,
      sheetSafe_(data.name),
      data.role,
      data.usage,
      sheetSafe_(toolText || '（無）'),
      JSON.stringify(data)
    ];

    if (foundRow > 0) {
      // 覆蓋前把舊資料留到「歷史紀錄」，被誤填或冒名覆蓋時可以追查還原
      ensureSheet_(ss, SHEET_HISTORY, MAIN_HEADERS).appendRow(oldRow);
      main.getRange(foundRow, 1, 1, row.length).setValues([row]);
    } else {
      main.appendRow(row);
    }

    rebuildToolSheet_(ss, main);
    SpreadsheetApp.flush(); // 釋放鎖之前確實寫入
    return { ok: true, updated: foundRow > 0, time: data.time };
  } finally {
    lock.releaseLock();
  }
}

// 依「填答」重建「工具使用明細」（一人一工具一列，方便樞紐分析）
function rebuildToolSheet_(ss, main) {
  var sh = ensureSheet_(ss, SHEET_TOOLS, TOOL_HEADERS);
  var rows = [];
  readResponses_(main).forEach(function (r) {
    (r.tools || []).forEach(function (t) {
      rows.push([
        new Date(r.time), r.dept, sheetSafe_(r.name), sheetSafe_(t.name), t.plan,
        SurveySchema.isPaidPlan(t.plan) ? '付費' : '免費或不清楚', t.payer, t.account, t.frequency
      ]);
    });
  });
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, TOOL_HEADERS.length).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, TOOL_HEADERS.length).setValues(rows);
}

/* ---------------- 統計（需管理密碼） ---------------- */

function handleStats_(password) {
  var adminPw = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  if (!adminPw || adminPw.length < 8) {
    return { ok: false, error: '尚未設定管理密碼（指令碼屬性 ADMIN_PASSWORD，至少 8 碼）' };
  }

  // 文件鎖與填答用的指令碼鎖分開：猜密碼不會卡住同仁送出問卷，也不能用並發請求繞過次數限制
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

  var main = ensureSheet_(SpreadsheetApp.getActiveSpreadsheet(), SHEET_MAIN, MAIN_HEADERS);
  return { ok: true, time: new Date().toISOString(), schemaVersion: SurveySchema.version, responses: readResponses_(main) };
}

// 讀出所有有效填答；同一人有多列時只取最後更新的一筆
function readResponses_(main) {
  var last = main.getLastRow();
  if (last < 2) return [];
  var vals = main.getRange(2, 1, last - 1, COL_JSON).getValues();
  var byKey = {};
  var order = [];
  vals.forEach(function (row) {
    var d = parseJson_(row[COL_JSON - 1]);
    if (!d || d.schemaVersion !== SurveySchema.version || !d.dept || !d.name) return;
    var k = personKey_(d.dept, d.name);
    if (!byKey[k]) order.push(k);
    if (!byKey[k] || String(d.time) > String(byKey[k].time)) byKey[k] = d;
  });
  return order.map(function (k) { return byKey[k]; });
}

/* ---------------- 工具函式 ---------------- */

// 取得工作表；若表頭和目前版本不同（例如第一版問卷留下的），把舊表改名保留，再建新表
function ensureSheet_(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (sh) {
    var cur = sh.getRange(1, 1, 1, headers.length).getValues()[0];
    if (cur.join('|') === headers.join('|')) return sh;
    sh.setName(name + '（舊版 ' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMdd-HHmm') + '）');
  }
  sh = ss.insertSheet(name);
  sh.getRange(1, 3, sh.getMaxRows(), headers.length - 2).setNumberFormat('@'); // 文字欄設純文字，避免被轉成數字或日期
  sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  sh.setFrozenRows(1);
  return sh;
}

function parseJson_(s) {
  if (typeof s !== 'string' || s.charAt(0) !== '{') return null;
  try { return JSON.parse(s); } catch (err) { return null; }
}

function personKey_(dept, name) {
  return String(dept).trim() + '|' + SurveySchema.nameKey(name);
}

// 防止試算表公式注入
function sheetSafe_(s) {
  s = String(s || '');
  return /^[=+\-@＝＋－＠']/.test(s) ? "'" + s : s;
}

// 先轉成固定長度的 SHA-256 再比對
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

/* 部署或更新後在編輯器中手動執行一次：建立工作表、確認密碼 */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, SHEET_MAIN, MAIN_HEADERS);
  ensureSheet_(ss, SHEET_TOOLS, TOOL_HEADERS);
  ensureSheet_(ss, SHEET_HISTORY, MAIN_HEADERS);
  var pw = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  console.log(pw && pw.length >= 8 ? '工作表已就緒，管理密碼已設定。' : '工作表已就緒。請到「專案設定 → 指令碼屬性」新增 ADMIN_PASSWORD（至少 8 碼）。');
}
