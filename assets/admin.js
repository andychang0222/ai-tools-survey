/* 統計頁：密碼只放在記憶體；所有文字一律用 textContent 輸出 */
(function () {
  'use strict';
  var C = window.SurveyCommon;
  var S = window.SurveySchema;
  var el = C.el;
  var $ = function (id) { return document.getElementById(id); };

  var password = '';
  var all = [];
  var SENSITIVE_FROM = 2; // dataTypes 第 3 個選項（客戶資料）起視為敏感資料
  var DATA_OPTS = findQ('dataTypes').options;
  var SENSITIVE = DATA_OPTS.slice(SENSITIVE_FROM);
  var PERSONAL = ['個人 Email', '沒有登入'];

  C.applyConfig();
  if (!C.apiReady()) { $('configAlert').hidden = false; $('loginBtn').disabled = true; }

  function findQ(id) {
    var found = null;
    S.SECTIONS.forEach(function (s) { s.questions.forEach(function (q) { if (q.id === id) found = q; }); });
    return found;
  }

  /* ================= 登入、載入、登出 ================= */
  var reqSeq = 0;
  var idleTimer = null;
  var IDLE_MS = 30 * 60 * 1000;

  function showLoginError(msg) { $('loginError').textContent = msg; $('loginError').hidden = !msg; }

  function load() {
    var seq = ++reqSeq;
    $('loginBtn').disabled = true;
    $('reloadBtn').disabled = true;
    showLoginError('');
    return C.callApi({ action: 'stats', password: password }).then(function (res) {
      if (seq !== reqSeq) return;
      if (!res || !res.ok) {
        var e = new Error((res && res.error) || '讀取失敗');
        e.auth = !!(res && res.error && /密碼/.test(res.error));
        throw e;
      }
      if (res.schemaVersion && res.schemaVersion !== S.version) {
        throw new Error('後端與網頁的問卷版本不同，請確認 Apps Script 已更新為最新的 Code.gs');
      }
      all = Array.isArray(res.responses) ? res.responses : [];
      buildDeptOptions();
      $('updatedAt').textContent = '資料時間 ' + C.formatTime(res.time);
      $('loginView').hidden = true;
      $('statsView').hidden = false;
      $('introText').textContent = '同部門同姓名以最後一次填寫為準。本頁含同仁姓名，請勿截圖外流。';
      render();
      resetIdle();
    }).catch(function (err) {
      if (seq !== reqSeq) return;
      if ($('statsView').hidden || err.auth) logout(err.message);
      else $('updatedAt').textContent = '重新整理失敗：' + err.message;
    }).finally(function () {
      if (seq !== reqSeq) return;
      $('loginBtn').disabled = !C.apiReady();
      $('reloadBtn').disabled = false;
    });
  }

  function logout(msg) {
    reqSeq++;
    password = '';
    all = [];
    clearTimeout(idleTimer);
    $('statsView').querySelectorAll('[id^="c-"], [id^="sub-"], #kpis, #updatedAt, #listCount').forEach(function (n) { n.textContent = ''; });
    $('deptFilter').value = '';
    $('search').value = '';
    $('statsView').hidden = true;
    $('loginView').hidden = false;
    $('loginBtn').disabled = !C.apiReady();
    $('reloadBtn').disabled = false;
    $('introText').textContent = '管理人員專用。請輸入管理密碼查看統計結果。';
    showLoginError(msg || '');
    $('pw').focus();
  }

  function resetIdle() {
    clearTimeout(idleTimer);
    if (!password) return;
    idleTimer = setTimeout(function () { logout('閒置超過 30 分鐘，已自動登出。'); }, IDLE_MS);
  }
  ['click', 'keydown', 'scroll'].forEach(function (ev) {
    document.addEventListener(ev, function () { if (!$('statsView').hidden) resetIdle(); }, { passive: true });
  });

  $('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    password = $('pw').value;
    $('pw').value = '';
    if (!password) { showLoginError('請輸入管理密碼'); return; }
    load();
  });
  $('reloadBtn').addEventListener('click', load);
  $('logoutBtn').addEventListener('click', function () { logout(''); });
  $('deptFilter').addEventListener('change', render);
  $('search').addEventListener('input', renderList);
  $('csvBtn').addEventListener('click', exportCsv);

  /* ================= 部門清單 ================= */
  function deptList() {
    var list = S.DEPARTMENTS.slice();
    all.forEach(function (r) { if (list.indexOf(r.dept) < 0) list.push(r.dept); });
    return list;
  }
  function buildDeptOptions() {
    var sel = $('deptFilter');
    var cur = sel.value;
    sel.textContent = '';
    sel.appendChild(el('option', { value: '', text: '全部部門' }));
    deptList().forEach(function (d) { sel.appendChild(el('option', { value: d, text: d })); });
    sel.value = deptList().indexOf(cur) >= 0 ? cur : '';
  }

  /* ================= 計算工具 ================= */
  function filtered() {
    var d = $('deptFilter').value;
    return all.filter(function (r) { return !d || r.dept === d; });
  }
  function isUser(r) { return S.USING.indexOf(r.usage) >= 0; }
  function hasSensitive(r) { return (r.dataTypes || []).some(function (x) { return SENSITIVE.indexOf(x) >= 0; }); }
  function usesPaid(r) { return (r.tools || []).some(function (t) { return S.isPaidPlan(t.plan); }); }
  function selfPaid(r) { return (r.tools || []).some(function (t) { return t.payer === '自己付費'; }); }
  function personalAcct(r) { return (r.tools || []).some(function (t) { return PERSONAL.indexOf(t.account) >= 0; }); }
  function pct(n, base) { return base ? Math.round((n / base) * 100) : 0; }

  // 某題各選項的人數（單選或複選），含「其他」
  function countOptions(rs, q) {
    var items = q.options.map(function (o) {
      return { label: o, count: rs.filter(function (r) {
        var v = r[q.id];
        return Array.isArray(v) ? v.indexOf(o) >= 0 : v === o;
      }).length };
    });
    if (q.other) {
      var n = rs.filter(function (r) { return !!r[q.id + 'Other']; }).length;
      if (n) items.push({ label: '其他（內容見「文字回饋」）', count: n });
    }
    return items;
  }

  /* ================= 繪圖元件 ================= */
  function put(id, node) { $(id).textContent = ''; if (node) $(id).appendChild(node); }

  // 單一序列橫條：長度為佔「回答人數」的比例；數值直接標示
  function bars(items, base, opts) {
    opts = opts || {};
    if (!base) return el('p', { className: 'empty', text: '目前沒有人回答這題。' });
    var list = items.slice();
    if (opts.sort) list.sort(function (a, b) { return b.count - a.count; });
    return el('div', { className: 'bars' }, list.map(function (it) {
      var fill = el('div', { className: 'bar-fill' + (it.risk ? ' risk' : '') });
      fill.style.width = pct(it.count, base) + '%';
      var label = el('span', { className: 'bar-label' }, [it.label, it.risk ? el('span', { className: 'tag risk', text: '敏感' }) : null]);
      var row = el('div', { className: 'bar-row' + (it.risk ? ' is-risk' : ''), title: it.label + '：' + it.count + ' 人，' + pct(it.count, base) + '%' }, [
        label,
        el('div', { className: 'bar-track' }, [fill]),
        el('span', { className: 'bar-value' }, [String(it.count), el('small', { text: pct(it.count, base) + '%' })])
      ]);
      return row;
    }));
  }

  function chart(qid, rs, baseLabel, opts) {
    var q = findQ(qid);
    var items = countOptions(rs, q);
    if (opts && opts.risk) items.forEach(function (it) { it.risk = SENSITIVE.indexOf(it.label) >= 0; });
    $('sub-' + qid).textContent = baseLabel + ' ' + rs.length + ' 人' + (q.type === 'checkbox' ? '，可複選' : '');
    put('c-' + qid, bars(items, rs.length, opts));
  }

  function table(headers, rows, numFrom) {
    return el('table', { className: 'data' }, [
      el('thead', null, [el('tr', null, headers.map(function (h, i) { return el('th', { className: i >= numFrom ? 'num' : '', text: h }); }))]),
      el('tbody', null, rows.map(function (cells) {
        return el('tr', null, cells.map(function (c, i) {
          if (c instanceof Node) return el('td', null, [c]);
          var cls = i >= numFrom ? 'num' : '';
          if (c === 0) cls += ' zero';
          return el('td', { className: cls, text: String(c) });
        }));
      }))
    ]);
  }

  /* ================= 繪製 ================= */
  function render() {
    var rs = filtered();
    var users = rs.filter(isUser);
    var nonUsers = rs.filter(function (r) { return !isUser(r); });

    // 重點數字
    var kpis = [
      { label: '填答人數', value: rs.length, sub: '來自 ' + uniq(rs.map(function (r) { return r.dept; })).length + ' 個部門' },
      { label: '工作上使用 AI', value: pct(users.length, rs.length) + '%', sub: users.length + ' 人經常或偶爾使用' },
      { label: '使用付費方案', value: rs.filter(usesPaid).length, sub: '其中 ' + rs.filter(selfPaid).length + ' 人自己付費' },
      { label: '用個人帳號使用', value: rs.filter(personalAcct).length, sub: '公司資料可能存在個人帳號', warn: true },
      { label: '曾輸入敏感資料', value: rs.filter(hasSensitive).length, sub: '客戶、報價、配方、財務、個資或帳密', warn: true }
    ];
    put('kpis', null);
    kpis.forEach(function (k) {
      $('kpis').appendChild(el('div', { className: 'kpi' + (k.warn && k.value ? ' warn' : '') }, [
        el('div', { className: 'kpi-value', text: String(k.value) }),
        el('div', { className: 'kpi-label', text: k.label }),
        el('div', { className: 'kpi-sub', text: k.sub })
      ]));
    });

    chart('usage', rs, '全部填答');
    chart('familiarity', rs, '全部填答');
    renderTools(users);
    chart('tasks', users, '目前使用者', { sort: true });
    chart('futureTasks', rs, '全部填答', { sort: true });
    chart('dataTypes', users, '目前使用者', { risk: true });
    chart('trainingAware', users, '目前使用者');
    chart('verify', users, '目前使用者');
    chart('devices', users, '目前使用者', { sort: true });
    chart('timeSaved', users, '目前使用者');
    chart('wantTools', rs, '全部填答', { sort: true });
    chart('wantFrequency', rs.filter(function (r) { return !!r.wantFrequency; }), '希望公司提供工具的');
    chart('support', rs, '全部填答', { sort: true });
    chart('policy', rs, '全部填答');
    chart('notUsingReasons', nonUsers, '目前沒有使用的', { sort: true });
    renderDept(rs);
    renderTexts(rs);
    renderList();
  }

  function uniq(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }

  function renderTools(users) {
    var defs = S.TOOLS.map(function (t) { return { id: t.id, name: t.name, plans: t.plans }; });
    defs.push({ id: 'other', name: '其他工具（人次）', plans: S.OTHER_PLANS });
    var rows = defs.map(function (d) {
      var entries = [];
      users.forEach(function (r) { (r.tools || []).forEach(function (t) { if (t.id === d.id) entries.push(t); }); });
      var n = entries.length;
      var count = function (f) { return entries.filter(f).length; };
      var plans = d.plans.map(function (p) { return { p: p, n: count(function (t) { return t.plan === p; }) }; })
        .filter(function (x) { return x.n; }).sort(function (a, b) { return b.n - a.n; });
      var planTags = el('div', null, plans.length ? plans.map(function (x) {
        return el('span', { className: 'tag' + (S.isPaidPlan(x.p) ? ' paid' : ''), text: x.p + ' ' + x.n });
      }) : [el('span', { className: 'empty', text: '—' })]);
      return [d.name, n,
        count(function (t) { return S.isPaidPlan(t.plan); }),
        count(function (t) { return t.payer === '自己付費'; }),
        count(function (t) { return t.payer === '公司付費'; }),
        count(function (t) { return PERSONAL.indexOf(t.account) >= 0; }),
        count(function (t) { return t.frequency === '每天多次' || t.frequency === '每天一次'; }),
        planTags];
    });
    put('c-tools', table(['工具', '使用人數', '付費方案', '自己付費', '公司付費', '個人帳號', '每天使用', '方案分布（深色為付費）'], rows, 1));
    // 方案欄不靠右
    $('c-tools').querySelectorAll('tbody td:last-child, thead th:last-child').forEach(function (n) { n.className = ''; });
  }

  function renderDept(rs) {
    var depts = $('deptFilter').value ? [$('deptFilter').value] : deptList();
    var rows = depts.map(function (d) {
      var dr = rs.filter(function (r) { return r.dept === d; });
      var want = {};
      dr.forEach(function (r) { (r.wantTools || []).forEach(function (w) { if (w !== '目前不需要') want[w] = (want[w] || 0) + 1; }); });
      var top = Object.keys(want).sort(function (a, b) { return want[b] - want[a]; })[0];
      return { cells: [d, dr.length, dr.filter(isUser).length, dr.filter(usesPaid).length, dr.filter(personalAcct).length, dr.filter(hasSensitive).length, top ? top + '（' + want[top] + '）' : '—'], n: dr.length };
    });
    var t = table(['部門', '填答', '使用 AI', '付費方案', '個人帳號', '曾輸入敏感資料', '最希望提供的工具'], rows.map(function (r) { return r.cells; }), 1);
    // 依「佔該部門填答人數的比例」上色（單一色系，越深比例越高）
    t.querySelectorAll('tbody tr').forEach(function (tr, i) {
      var n = rows[i].n;
      [2, 3, 4, 5].forEach(function (ci) {
        var v = rows[i].cells[ci];
        if (!n || !v) return;
        tr.children[ci].classList.add('heat-' + Math.max(1, Math.ceil((v / n) * 4)));
        tr.children[ci].title = pct(v, n) + '%';
      });
    });
    t.querySelector('thead th:last-child').className = '';
    t.querySelectorAll('tbody td:last-child').forEach(function (n) { n.className = ''; });
    put('c-dept', t);
  }

  function renderTexts(rs) {
    var groups = [
      { title: 'AI 幫最多的實際例子', pick: function (r) { return r.example ? [r.example] : []; } },
      { title: '其他意見或建議', pick: function (r) { return r.comment ? [r.comment] : []; } },
      { title: '自行填寫的其他工具', pick: function (r) {
        return (r.tools || []).filter(function (t) { return t.other; }).map(function (t) { return '使用中：' + t.name + '（' + t.plan + '）'; })
          .concat(r.wantToolsOther ? ['希望提供：' + r.wantToolsOther] : []);
      } },
      { title: '自行填寫的其他選項', pick: function (r) {
        var out = [];
        if (r.tasksOther) out.push('目前用途：' + r.tasksOther);
        if (r.futureTasksOther) out.push('希望用途：' + r.futureTasksOther);
        if (r.notUsingReasonsOther) out.push('沒使用原因：' + r.notUsingReasonsOther);
        if (r.supportOther) out.push('希望支援：' + r.supportOther);
        return out;
      } }
    ];
    var box = el('div', { className: 'grid-2' });
    groups.forEach(function (g) {
      var quotes = [];
      rs.forEach(function (r) { g.pick(r).forEach(function (txt) { quotes.push(el('blockquote', { className: 'quote' }, [txt, el('cite', { text: r.dept + ' ' + r.name })])); }); });
      box.appendChild(el('div', null, [el('h3', { className: 'tp-field-label', text: g.title + '（' + quotes.length + '）' })].concat(
        quotes.length ? quotes : [el('p', { className: 'empty', text: '目前沒有。' })])));
    });
    put('c-texts', box);
  }

  function renderList() {
    var q = $('search').value.replace(/\s+/g, '').toLowerCase();
    var order = {};
    deptList().forEach(function (d, i) { order[d] = i; });
    var rs = filtered().filter(function (r) {
      if (!q) return true;
      return (r.dept + r.name + (r.tools || []).map(function (t) { return t.name; }).join('')).replace(/\s+/g, '').toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) {
      return ((order[a.dept] !== undefined ? order[a.dept] : 999) - (order[b.dept] !== undefined ? order[b.dept] : 999)) || a.name.localeCompare(b.name, 'zh-Hant');
    });
    $('listCount').textContent = '共 ' + rs.length + ' 人。深色標籤為付費方案。';
    put('c-list', table(['部門', '姓名', '職務', '使用情況', '使用中的工具', '敏感資料', '希望公司提供', '最後更新'], rs.map(function (r) {
      var tools = el('div', null, (r.tools || []).length ? r.tools.map(function (t) {
        return el('span', { className: 'tag' + (S.isPaidPlan(t.plan) ? ' paid' : ''), title: t.plan + '・' + (t.payer || '免費') + '・' + t.account + '・' + t.frequency, text: t.name + ' ' + t.plan });
      }) : [el('span', { className: 'empty', text: '—' })]);
      var sens = (r.dataTypes || []).filter(function (x) { return SENSITIVE.indexOf(x) >= 0; });
      var sensNode = sens.length ? el('span', { className: 'tag risk', title: sens.join('、'), text: sens.length + ' 類' }) : el('span', { className: 'empty', text: '—' });
      var want = (r.wantTools || []).concat(r.wantToolsOther ? [r.wantToolsOther] : []).join('、');
      return [r.dept, r.name, r.role, r.usage.replace('（每週數次以上）', ''), tools, sensNode, want, C.formatTime(r.time)];
    }), 99));
  }

  /* ================= 匯出 CSV（Excel 可直接開啟） ================= */
  function csvCell(v) {
    var s = Array.isArray(v) ? v.join('、') : String(v === undefined || v === null ? '' : v);
    if (/^\s*[=+\-@＝＋－＠|']/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }

  function exportCsv() {
    var cols = [];
    S.SECTIONS.forEach(function (sec) {
      sec.questions.forEach(function (q) {
        if (q.type === 'tools') {
          S.TOOLS.forEach(function (t) {
            ['plan', 'payer', 'account', 'frequency'].forEach(function (f) {
              var name = { plan: '方案', payer: '費用支付', account: '登入帳號', frequency: '使用頻率' }[f];
              cols.push({ h: t.name + '｜' + name, get: function (r) { var x = (r.tools || []).filter(function (y) { return y.id === t.id; })[0]; return x ? x[f] : ''; } });
            });
          });
          cols.push({ h: '其他工具', get: function (r) { return (r.tools || []).filter(function (t) { return t.other; }).map(function (t) { return t.name + '（' + t.plan + '、' + (t.payer || '免費') + '、' + t.account + '、' + t.frequency + '）'; }); } });
        } else {
          cols.push({ h: q.short || q.label, get: function (r) { return r[q.id]; } });
          if (q.other) cols.push({ h: (q.short || q.label) + '｜其他', get: function (r) { return r[q.id + 'Other']; } });
        }
      });
    });
    cols.push({ h: '首次填寫時間', get: function (r) { return C.formatTime(r.firstTime); } });
    cols.push({ h: '最後更新時間', get: function (r) { return C.formatTime(r.time); } });

    var lines = [cols.map(function (c) { return csvCell(c.h); }).join(',')];
    filtered().forEach(function (r) { lines.push(cols.map(function (c) { return csvCell(c.get(r)); }).join(',')); });
    var csv = String.fromCharCode(0xFEFF) + lines.join('\r\n');
    var url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    var d = new Date();
    var stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    var a = el('a', { href: url, download: 'AI工具調查_' + ($('deptFilter').value || '全部') + '_' + stamp + '.csv' });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
})();
