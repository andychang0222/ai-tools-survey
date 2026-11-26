/**
 * 八貫企業股份有限公司（Cathay Consolidated, Inc）
 * AI 工具使用現況與需求調查：Google Apps Script 後端
 *
 * ※ 本檔由 apps-script/build.js 自動產生，請勿直接修改。
 *   題目請改 assets/schema.js，後端請改 apps-script/server.gs，再執行 node apps-script/build.js。
 *
 * 部署方式見 README.md。管理密碼放在「專案設定 → 指令碼屬性」的 ADMIN_PASSWORD。
 */

/*
 * 問卷題目定義與驗證規則（填答頁與 Google Apps Script 後端共用同一份）
 * 修改題目後，請執行 `node apps-script/build.js` 重新產生 apps-script/Code.gs，
 * 再把 Code.gs 貼到 Apps Script 並重新部署。
 * 注意：本檔需同時能在瀏覽器與 Apps Script（V8）執行，請只用 ES5 語法加上 Array 方法。
 */
var SurveySchema = (function () {
  'use strict';

  var DEPARTMENTS = [
    '董事長室', '工程一部', '行政部', '品保一部', '業務部', '製造一部', '資材一部',
    '工程三部', '製造三部', '品保三部', '資材三部', '會計部', '財務部', '總經理室'
  ];

  // 各工具的方案；以「免費」開頭或「不清楚」視為非付費方案
  var TOOLS = [
    { id: 'chatgpt', name: 'ChatGPT', vendor: 'OpenAI',
      plans: ['免費版', 'Plus', 'Pro', 'Business（原 Team）', 'Enterprise', '不清楚'] },
    { id: 'claude', name: 'Claude', vendor: 'Anthropic',
      plans: ['免費版', 'Pro', 'Max', 'Team', 'Enterprise', '不清楚'] },
    { id: 'gemini', name: 'Gemini', vendor: 'Google',
      plans: ['免費版', 'Google AI Pro', 'Google AI Ultra', 'Google Workspace 方案內含', '不清楚'] },
    { id: 'copilot', name: 'Microsoft 365 Copilot', vendor: 'Microsoft，含 Edge／Bing 的 Copilot',
      plans: ['免費版（Edge、Bing 或 Copilot App）', 'Microsoft 365 Copilot（公司授權）', '個人付費版（Microsoft 365 個人／家用版、Copilot Pro）', '不清楚'] }
  ];
  var OTHER_PLANS = ['免費版', '付費版', '不清楚'];
  var MAX_OTHER_TOOLS = 3;
  var PAYERS = ['自己付費', '公司付費', '不清楚'];
  var ACCOUNTS = ['公司 Email', '個人 Email', '沒有登入'];
  var TOOL_FREQ = ['每天多次', '每天一次', '每週數次', '每週一次', '每月數次'];

  var TASKS = [
    '文件撰寫與潤飾', 'Email 撰寫與回覆', '翻譯', '會議記錄與摘要',
    '閱讀與摘要長文件（規格書、合約、報告）', '資料分析、Excel 公式與報表', '簡報製作',
    '查詢資料與研究', '程式、VBA、巨集或系統設定', '圖片或圖表設計',
    '報價、客戶或業務文件', '品質、技術或製程文件', '學習新知、問答'
  ];

  var USING = ['經常使用（每週數次以上）', '偶爾使用'];
  var IS_USER = { q: 'usage', in: USING };

  var SECTIONS = [
    {
      id: 'basic', title: '基本資料', desc: '只用來依部門統計，不會要求任何帳號或員工編號。',
      questions: [
        { id: 'dept', type: 'select', label: '部門', short: '部門', options: DEPARTMENTS, required: true },
        { id: 'name', type: 'text', label: '姓名', short: '姓名', max: 20, required: true, letter: true, placeholder: '請填寫中文全名' },
        { id: 'role', type: 'radio', label: '職務', short: '職務', options: ['主管職', '非主管職'], required: true },
        { id: 'pcTime', type: 'radio', label: '工作中使用電腦的時間', short: '使用電腦的時間', options: ['大部分時間', '大約一半', '很少'], required: true }
      ]
    },
    {
      id: 'current', title: '使用現況', desc: '請依你「目前工作上」的實際情況回答，沒有標準答案。',
      questions: [
        { id: 'familiarity', type: 'radio', label: '你對 AI 工具的熟悉程度', short: '熟悉程度', required: true,
          options: ['沒用過', '聽過，但很少用', '會用來問問題、寫東西', '能熟練運用在工作上', '能教別人使用'] },
        { id: 'usage', type: 'radio', label: '目前工作上使用 AI 的情況', short: '使用情況', required: true,
          options: USING.concat(['曾經試用，現在沒在用', '從未使用']) },
        { id: 'notUsingReasons', type: 'checkbox', label: '沒有使用或停用的原因', short: '沒有使用的原因', hint: '可複選', required: true, other: true,
          showIf: { q: 'usage', in: ['曾經試用，現在沒在用', '從未使用'] },
          options: ['不知道怎麼用', '不確定公司是否允許', '擔心公司資料外洩', '工作上用不到', '覺得結果不可靠', '要付費', '公司網路或電腦無法使用'] },
        { id: 'tools', type: 'tools', label: '目前使用哪些 AI 工具', short: '使用的工具', hint: '可複選，選了之後請填方案與使用頻率', required: true, showIf: IS_USER },
        { id: 'devices', type: 'checkbox', label: '通常在哪裡使用 AI', short: '使用裝置', hint: '可複選', required: true, showIf: IS_USER,
          options: ['公司電腦', '個人電腦', '個人手機', '公司手機或平板'] },
        { id: 'tasks', type: 'checkbox', label: '目前用 AI 協助哪些工作', short: '目前用途', hint: '可複選', required: true, other: true, showIf: IS_USER, options: TASKS },
        { id: 'example', type: 'textarea', label: '舉一個 AI 幫你最多的實際例子', short: '實際例子', hint: '選填', max: 300, showIf: IS_USER,
          placeholder: '例如：把客戶的英文規格書整理成中文重點，原本要一小時，現在十分鐘' },
        { id: 'timeSaved', type: 'radio', label: '使用 AI 後，每週大約節省多少工作時間', short: '節省時間', required: true, showIf: IS_USER,
          options: ['不到 1 小時', '1～3 小時', '3～5 小時', '5 小時以上', '說不上來'] }
      ]
    },
    {
      id: 'security', title: '資料安全', showIf: IS_USER,
      desc: '這部分用來規劃資料保護措施與教育訓練，不會追究個人責任，請依實際情況填寫。',
      questions: [
        { id: 'dataTypes', type: 'checkbox', label: '曾經輸入或上傳到 AI 的資料', short: '輸入過的資料', hint: '可複選', required: true,
          exclusive: '只有公開資料或與公司無關的內容',
          options: ['只有公開資料或與公司無關的內容', '一般內部文件（會議記錄、內部通知）', '客戶資料（名稱、聯絡人、訂單）', '報價、價格或成本',
            '產品配方、規格、圖面或製程參數', '財務或會計資料', '員工個人資料', '程式碼、系統設定或帳號密碼'] },
        { id: 'trainingAware', type: 'radio', label: '你知道 AI 服務可能保存對話內容，甚至用來訓練模型嗎？', short: '資料保存設定', required: true,
          options: ['知道，而且已關閉相關設定', '知道，但沒有特別設定', '不知道'] },
        { id: 'verify', type: 'radio', label: '使用 AI 產出的內容前，你會查核正確性嗎？', short: '查核習慣', required: true,
          options: ['每次都會', '重要的才會', '很少查核'] }
      ]
    }
  ];

  /* ---------- 工具函式 ---------- */

  function cleanText(s, max, multiline) {
    if (typeof s !== 'string') return '';
    if (multiline) {
      s = s.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '')
        .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
    } else {
      s = s.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ');
    }
    return s.trim().slice(0, max);
  }

  function nameKey(s) { return String(s).replace(/\s+/g, '').toLowerCase(); }

  function isPaidPlan(plan) { return !!plan && plan.indexOf('免費') !== 0 && plan !== '不清楚'; }

  function findTool(id) {
    for (var i = 0; i < TOOLS.length; i++) if (TOOLS[i].id === id) return TOOLS[i];
    return null;
  }

  function cond(c, data) {
    var v = data[c.q];
    if (c['in']) return c['in'].indexOf(v) >= 0;
    if (c.anyExcept) {
      return (Array.isArray(v) && v.some(function (x) { return x !== c.anyExcept; })) || !!data[c.q + 'Other'];
    }
    return true;
  }

  function emptyValue(q) {
    if (q.type === 'checkbox' || q.type === 'tools') return [];
    return '';
  }

  /* ---------- 驗證 ----------
   * 回傳 { data, errors, sections }
   * - data：清理後、只含目前可見題目的資料（隱藏題目一律清空）
   * - errors：[{ id, msg, tool?, field? }]
   * - sections：[{ id, visible, total, done }]（必填題的完成進度）
   */
  function validate(raw) {
    raw = raw && typeof raw === 'object' ? raw : {};
    var data = {};
    var errors = [];
    var sections = [];

    SECTIONS.forEach(function (sec) {
      var secVisible = !sec.showIf || cond(sec.showIf, data);
      var stat = { id: sec.id, visible: secVisible, total: 0, done: 0, questions: [] };

      sec.questions.forEach(function (q) {
        var visible = secVisible && (!q.showIf || cond(q.showIf, data));
        stat.questions.push({ id: q.id, visible: visible });
        if (!visible) {
          data[q.id] = emptyValue(q);
          if (q.other) data[q.id + 'Other'] = '';
          return;
        }
        var before = errors.length;
        checkQuestion(q, raw, data, errors);
        if (q.required) {
          stat.total++;
          if (errors.length === before) stat.done++;
        }
      });
      sections.push(stat);
    });

    return { data: data, errors: errors, sections: sections };
  }

  function checkQuestion(q, raw, data, errors) {
    var label = q.short || q.label;
    var v = raw[q.id];

    if (q.type === 'select' || q.type === 'radio') {
      v = typeof v === 'string' ? v : '';
      if (v && q.options.indexOf(v) < 0) v = '';
      data[q.id] = v;
      if (q.required && !v) errors.push({ id: q.id, msg: label + '：請' + (q.type === 'select' ? '選擇' : '選擇一項') });
      return;
    }

    if (q.type === 'text' || q.type === 'textarea') {
      v = cleanText(v, q.max, q.type === 'textarea');
      data[q.id] = v;
      if (q.required && (!v || (q.letter && !/[\p{L}]/u.test(v)))) errors.push({ id: q.id, msg: '請填寫' + label });
      return;
    }

    if (q.type === 'checkbox') {
      var arr = [];
      (Array.isArray(v) ? v : []).forEach(function (x) {
        if (typeof x === 'string' && q.options.indexOf(x) >= 0 && arr.indexOf(x) < 0) arr.push(x);
      });
      var other = q.other ? cleanText(raw[q.id + 'Other'], 50) : '';
      data[q.id] = arr;
      if (q.other) data[q.id + 'Other'] = other;
      if (q.exclusive && arr.indexOf(q.exclusive) >= 0 && (arr.length > 1 || other)) {
        errors.push({ id: q.id, msg: label + '：「' + q.exclusive + '」不能和其他選項同時選' });
        return;
      }
      if (q.required && !arr.length && !other) errors.push({ id: q.id, msg: label + '：請至少選擇一項' });
      return;
    }

    if (q.type === 'tools') {
      checkTools(q, v, data, errors);
    }
  }

  function checkTools(q, list, data, errors) {
    var out = [];
    var seen = {};
    var otherCount = 0;
    list = Array.isArray(list) ? list.slice(0, TOOLS.length + MAX_OTHER_TOOLS) : [];

    list.forEach(function (t, idx) {
      if (!t || typeof t !== 'object') return;
      var def, name, plans, key;
      if (t.other === true) {
        if (++otherCount > MAX_OTHER_TOOLS) return;
        name = cleanText(t.name, 40);
        key = 'other' + idx;
        if (!name) { errors.push({ id: 'tools', tool: key, field: 'name', msg: '其他工具：請填寫工具名稱，或按「移除」' }); return; }
        var k = nameKey(name);
        if (TOOLS.some(function (d) { return nameKey(d.name) === k; })) {
          errors.push({ id: 'tools', tool: key, field: 'name', msg: name + '：已列在上方，請直接點選上方的工具' }); return;
        }
        if (seen['o:' + k]) { errors.push({ id: 'tools', tool: key, field: 'name', msg: name + '：重複填寫' }); return; }
        seen['o:' + k] = true;
        plans = OTHER_PLANS;
      } else {
        def = findTool(t.id);
        if (!def || seen[def.id]) return;
        seen[def.id] = true;
        name = def.name;
        key = def.id;
        plans = def.plans;
      }

      var item = { id: def ? def.id : 'other', name: name, other: !def, plan: '', payer: '', account: '', frequency: '' };
      var ok = true;
      function need(field, value, options, msg) {
        if (typeof value === 'string' && options.indexOf(value) >= 0) { item[field] = value; return; }
        errors.push({ id: 'tools', tool: key, field: field, msg: name + '：' + msg });
        ok = false;
      }
      need('plan', t.plan, plans, '請選擇使用的方案');
      if (isPaidPlan(item.plan)) need('payer', t.payer, PAYERS, '請選擇費用由誰支付');
      need('account', t.account, ACCOUNTS, '請選擇登入的帳號');
      need('frequency', t.frequency, TOOL_FREQ, '請選擇使用頻率');
      out.push(item);
      return ok;
    });

    data.tools = out;
    if (q.required && !out.length && !errors.some(function (e) { return e.id === 'tools'; })) {
      errors.push({ id: 'tools', msg: (q.short || q.label) + '：請至少選擇一項' });
    }
  }

  return {
    version: 3,
    DEPARTMENTS: DEPARTMENTS,
    TOOLS: TOOLS,
    OTHER_PLANS: OTHER_PLANS,
    MAX_OTHER_TOOLS: MAX_OTHER_TOOLS,
    PAYERS: PAYERS,
    ACCOUNTS: ACCOUNTS,
    TOOL_FREQ: TOOL_FREQ,
    TASKS: TASKS,
    USING: USING,
    SECTIONS: SECTIONS,
    cleanText: cleanText,
    nameKey: nameKey,
    isPaidPlan: isPaidPlan,
    validate: validate
  };
})();

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
