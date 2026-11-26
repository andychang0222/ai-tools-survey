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
      id: 'basic', title: '基本資料', desc: '只用來統計部門需求，不會要求任何帳號或員工編號。',
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
    },
    {
      id: 'needs', title: '需求與期望', desc: '公司會依大家的需求，規劃授權採購、教育訓練與使用規範。',
      questions: [
        { id: 'wantTools', type: 'checkbox', label: '希望公司提供或授權哪些 AI 工具', short: '希望提供的工具', hint: '可複選', required: true, other: true,
          exclusive: '目前不需要', options: ['ChatGPT', 'Claude', 'Gemini', 'Microsoft 365 Copilot', '目前不需要'] },
        { id: 'wantFrequency', type: 'radio', label: '如果公司提供，你預計多久使用一次', short: '預計使用頻率', required: true,
          showIf: { q: 'wantTools', anyExcept: '目前不需要' }, options: TOOL_FREQ.concat(['偶爾']) },
        { id: 'futureTasks', type: 'checkbox', label: '希望 AI 協助哪些工作', short: '希望的用途', hint: '可複選，可以和目前的用途相同', required: true, other: true, options: TASKS },
        { id: 'support', type: 'checkbox', label: '希望公司提供哪些支援', short: '希望的支援', hint: '可複選', required: true, other: true,
          exclusive: '不需要',
          options: ['統一採購企業版帳號', 'AI 教育訓練課程', 'AI 使用規範與資安指引', '各部門使用案例與範本', '專人諮詢窗口', '不需要'] },
        { id: 'policy', type: 'radio', label: '你認為公司應該怎麼管理 AI 的使用', short: '管理方式', required: true,
          options: ['統一提供工具，並明訂使用規範', '提供指引，讓同仁自行選擇工具', '不需要特別規範', '沒有意見'] },
        { id: 'comment', type: 'textarea', label: '其他意見或建議', short: '其他意見', hint: '選填', max: 500,
          placeholder: '例如：希望開哪些課程、擔心什麼、想要什麼功能' }
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
    version: 2,
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
