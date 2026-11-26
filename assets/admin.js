/* 統計頁邏輯：密碼只放在記憶體，不寫入瀏覽器儲存空間 */
(function () {
  'use strict';
  var C = window.SurveyCommon;
  var CFG = C.CFG;
  var el = C.el;

  var password = '';
  var all = [];
  var STATUS_CLASS = ['none', 'free', 'paid'];

  var $ = function (id) { return document.getElementById(id); };
  C.applyConfig();
  if (!C.apiReady()) { $('configAlert').hidden = false; $('loginBtn').disabled = true; }

  // 部門清單：設定檔的部門，再加上資料裡出現、但設定檔沒有的部門（例如日後改過部門名稱）
  function deptList() {
    var list = CFG.departments.slice();
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
  buildDeptOptions();

  // 圖例
  CFG.statuses.forEach(function (s, i) {
    var span = el('span', { text: s });
    span.style.setProperty('--c', ['#c9d3df', '#7fa3cc', '#1f3a5f'][i]);
    $('statusLegend').appendChild(span);
  });

  /* ---------- 登入與載入 ---------- */
  var reqSeq = 0;          // 每次登出或重新載入都遞增，舊請求回來時直接丟棄
  var idleTimer = null;
  var IDLE_MS = 30 * 60 * 1000; // 30 分鐘沒有操作自動登出

  function showLoginError(msg) {
    $('loginError').textContent = msg;
    $('loginError').hidden = !msg;
  }

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
      all = Array.isArray(res.responses) ? res.responses : [];
      buildDeptOptions();
      $('updatedAt').textContent = '資料時間：' + C.formatTime(res.time);
      $('loginView').hidden = true;
      $('statsView').hidden = false;
      $('introText').textContent = '同部門同姓名以最後一次填寫為準。本頁含同仁姓名，請勿截圖外流。';
      render();
      resetIdle();
    }).catch(function (err) {
      if (seq !== reqSeq) return;
      if ($('statsView').hidden || err.auth) {
        // 登入失敗，或重新整理時密碼已失效：清掉記憶體中的密碼，避免重複送出舊密碼造成鎖定
        logout(err.message);
      } else {
        $('updatedAt').textContent = '重新整理失敗：' + err.message;
      }
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
    ['kpis', 'toolTable', 'deptTable', 'freqTable', 'purposeTable', 'otherTable', 'listTable', 'updatedAt', 'listCount'].forEach(function (id) { $(id).textContent = ''; });
    $('deptFilter').value = '';
    $('search').value = '';
    $('statsView').hidden = true;
    $('loginView').hidden = false;
    $('loginBtn').disabled = !C.apiReady();
    $('reloadBtn').disabled = false;
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

  /* ---------- 計算 ---------- */
  function filtered() {
    var d = $('deptFilter').value;
    return all.filter(function (r) { return !d || r.dept === d; });
  }

  function needed(r) { return (r.tools || []).filter(function (t) { return t.need; }); }

  function toolKey(t) { return t.other ? 'other' : t.id; }

  function statusIndex(s) { return CFG.statuses.indexOf(s); }

  // 取某人對某工具的需求（統計一律以人數計）。
  // 「其他」一人可填多項：合併成一筆，使用狀況取最高（付費 > 免費 > 尚未使用）、頻率取最頻繁、用途取聯集
  function personTool(r, defId) {
    var ts = needed(r).filter(function (t) { return toolKey(t) === defId; });
    if (!ts.length) return null;
    var out = { status: '', frequency: '', purposes: [], purposeOther: '' };
    var si = -1, fi = Infinity;
    ts.forEach(function (t) {
      var s = statusIndex(t.status);
      if (s > si) { si = s; out.status = t.status; }
      var f = CFG.frequencies.indexOf(t.frequency);
      if (f >= 0 && f < fi) { fi = f; out.frequency = t.frequency; }
      (t.purposes || []).forEach(function (p) { if (out.purposes.indexOf(p) < 0) out.purposes.push(p); });
      if (t.purposeOther) out.purposeOther = t.purposeOther;
    });
    return out;
  }

  /* ---------- 表格工具 ---------- */
  function table(headers, rows, numFrom) {
    var thead = el('thead', null, [el('tr', null, headers.map(function (h, i) {
      return el('th', { className: i >= numFrom ? 'num' : '', text: h });
    }))]);
    var tbody = el('tbody', null, rows.map(function (cells) {
      return el('tr', null, cells.map(function (c, i) {
        if (c instanceof Node) return el('td', { className: c.dataset && c.dataset.cls || '' }, [c]);
        var cls = i >= numFrom ? 'num' : '';
        if (typeof c === 'number' && c === 0) cls += ' zero';
        return el('td', { className: cls, text: String(c) });
      }));
    }));
    return el('table', { className: 'data' }, [thead, tbody]);
  }

  // heatFrom～heatTo 為上色的欄位範圍（不含「填答人數」「合計」這類總數欄，避免壓低色階）
  function heatTable(headers, rows, numFrom, heatFrom, heatTo) {
    if (heatFrom === undefined) heatFrom = numFrom;
    if (heatTo === undefined) heatTo = headers.length - 1;
    var inRange = function (i) { return i >= heatFrom && i <= heatTo; };
    var max = 0;
    rows.forEach(function (r) { r.forEach(function (c, i) { if (inRange(i) && typeof c === 'number' && c > max) max = c; }); });
    var t = table(headers, rows, numFrom);
    t.querySelectorAll('tbody tr').forEach(function (tr, ri) {
      tr.querySelectorAll('td').forEach(function (td, ci) {
        var v = rows[ri][ci];
        if (!inRange(ci) || typeof v !== 'number') return;
        var level = v === 0 || max === 0 ? 0 : Math.max(1, Math.ceil((v / max) * 4));
        td.classList.add('heat-' + level);
      });
    });
    return t;
  }

  function barNode(value, max, cls) {
    var fill = el('div', { className: 'bar-fill ' + (cls || '') });
    fill.style.width = (max ? (value / max) * 100 : 0) + '%';
    var n = el('div', { className: 'bar' }, [el('div', { className: 'bar-track' }, [fill]), el('span', { className: 'bar-num', text: String(value) })]);
    n.dataset.cls = 'bar-cell';
    return n;
  }

  function stackNode(counts, total) {
    var track = el('div', { className: 'bar-track' });
    counts.forEach(function (c, i) {
      if (!c) return;
      var f = el('div', { className: 'bar-fill ' + STATUS_CLASS[i], title: CFG.statuses[i] + '：' + c });
      f.style.width = (total ? (c / total) * 100 : 0) + '%';
      track.appendChild(f);
    });
    var n = el('div', { className: 'bar' }, [track]);
    n.dataset.cls = 'bar-cell';
    return n;
  }

  function put(id, node) { $(id).textContent = ''; $(id).appendChild(node); }

  /* ---------- 繪製 ---------- */
  function render() {
    var rs = filtered();
    var toolDefs = CFG.tools.concat([{ id: 'other', name: '其他工具（合計）' }]);

    // KPI
    var deptSet = {};
    var anyNeed = 0, anyUsing = 0, paidCount = 0;
    rs.forEach(function (r) {
      deptSet[r.dept] = true;
      var n = needed(r);
      if (n.length) anyNeed++;
      if (n.some(function (t) { return statusIndex(t.status) > 0; })) anyUsing++;
      n.forEach(function (t) { if (statusIndex(t.status) === 2) paidCount++; });
    });
    var kpis = [
      ['填答人數', rs.length, '人'],
      ['已填答部門', Object.keys(deptSet).length, '／ ' + ($('deptFilter').value ? 1 : deptList().length) + ' 個部門'],
      ['需要 AI 工具', anyNeed, '人（至少一項）'],
      ['已在使用', anyUsing, '人（至少一項）'],
      ['付費使用中', paidCount, '人次']
    ];
    $('kpis').textContent = '';
    kpis.forEach(function (k) {
      $('kpis').appendChild(el('div', { className: 'kpi' }, [
        el('div', { className: 'kpi-label', text: k[0] }),
        el('div', { className: 'kpi-value', text: String(k[1]) }),
        el('div', { className: 'kpi-sub', text: k[2] })
      ]));
    });

    // 一、各工具需求與使用狀況（全部以人數計；「其他」一人填多項只算一人，見 personTool）
    var toolRows = toolDefs.map(function (def) {
      var people = 0;
      var st = [0, 0, 0];
      rs.forEach(function (r) {
        var t = personTool(r, def.id);
        if (!t) return;
        people++;
        var i = statusIndex(t.status); if (i >= 0) st[i]++;
      });
      return { name: def.name, people: people, st: st };
    });
    var maxPeople = Math.max.apply(null, toolRows.map(function (r) { return r.people; }).concat([1]));
    put('toolTable', table(
      ['工具', '需要人數', '尚未使用', '免費版', '付費版', '使用狀況比例', '需求占填答人數'],
      toolRows.map(function (r) {
        var stTotal = r.st[0] + r.st[1] + r.st[2];
        var pct = rs.length ? Math.round((r.people / rs.length) * 100) + '%' : '—';
        return [r.name, barNode(r.people, maxPeople), r.st[0], r.st[1], r.st[2], stackNode(r.st, stTotal), pct];
      }), 2));

    // 二、部門 × 工具
    var depts = $('deptFilter').value ? [$('deptFilter').value] : deptList();
    put('deptTable', heatTable(
      ['部門', '填答人數'].concat(toolDefs.map(function (d) { return d.id === 'other' ? '其他' : d.name; })),
      depts.map(function (dept) {
        var drs = rs.filter(function (r) { return r.dept === dept; });
        return [dept, drs.length].concat(toolDefs.map(function (def) {
          return drs.filter(function (r) { return !!personTool(r, def.id); }).length;
        }));
      }), 1, 2));

    // 三、頻率（人數）
    put('freqTable', heatTable(
      ['工具'].concat(CFG.frequencies),
      toolDefs.map(function (def) {
        return [def.name].concat(CFG.frequencies.map(function (f) {
          return rs.filter(function (r) { var t = personTool(r, def.id); return t && t.frequency === f; }).length;
        }));
      }), 1));

    // 四、用途（人數，可複選）
    var purposeRows = CFG.purposes.concat(['其他']).map(function (p) {
      return [p].concat(toolDefs.map(function (def) {
        return rs.filter(function (r) {
          var t = personTool(r, def.id);
          return t && (p === '其他' ? !!t.purposeOther : t.purposes.indexOf(p) >= 0);
        }).length;
      }));
    });
    purposeRows.forEach(function (row) { row.push(row.slice(1).reduce(function (a, b) { return a + b; }, 0)); });
    purposeRows.sort(function (a, b) { return b[b.length - 1] - a[a.length - 1]; });
    put('purposeTable', heatTable(
      ['用途'].concat(toolDefs.map(function (d) { return d.id === 'other' ? '其他工具' : d.name; })).concat(['合計']),
      purposeRows, 1, 1, toolDefs.length));

    // 五、其他工具名稱彙整、其他用途
    var others = {};
    rs.forEach(function (r) {
      needed(r).forEach(function (t) {
        if (!t.other) return;
        var k = t.name.replace(/\s+/g, '').toLowerCase();
        if (!others[k]) others[k] = { name: t.name, people: [], st: [0, 0, 0] };
        others[k].people.push(r.dept + ' ' + r.name);
        var i = statusIndex(t.status); if (i >= 0) others[k].st[i]++;
      });
    });
    var otherRows = Object.keys(others).map(function (k) { return others[k]; })
      .sort(function (a, b) { return b.people.length - a.people.length; })
      .map(function (o) { return ['工具：' + o.name, o.people.length, o.st[0], o.st[1], o.st[2], wrapCell(o.people.join('、'))]; });
    rs.forEach(function (r) {
      needed(r).forEach(function (t) {
        if (t.purposeOther) otherRows.push(['用途：' + t.purposeOther, 1, '', '', '', wrapCell(r.dept + ' ' + r.name + '（' + t.name + '）')]);
      });
    });
    if (otherRows.length) {
      put('otherTable', table(['項目', '人數', '尚未使用', '免費版', '付費版', '填答人'], otherRows, 1));
    } else {
      put('otherTable', el('p', { className: 'updated', text: '目前沒有自行輸入的工具或用途。' }));
    }

    renderList();
  }

  function wrapCell(text) {
    var s = el('span', { text: text });
    s.dataset.cls = 'wrap';
    return s;
  }

  function renderList() {
    var q = $('search').value.replace(/\s+/g, '').toLowerCase();
    var order = {};
    deptList().forEach(function (d, i) { order[d] = i; });
    var rs = filtered().filter(function (r) {
      if (!q) return true;
      var hay = (r.name + needed(r).map(function (t) { return t.name; }).join('')).replace(/\s+/g, '').toLowerCase();
      return hay.indexOf(q) >= 0;
    }).sort(function (a, b) {
      return (order[a.dept] - order[b.dept]) || a.name.localeCompare(b.name, 'zh-Hant');
    });

    $('listCount').textContent = '共 ' + rs.length + ' 人';
    put('listTable', table(['部門', '姓名', '需要的工具（頻率・使用狀況）', '其他意見', '最後更新'],
      rs.map(function (r) {
        var n = needed(r);
        var tags = el('div', null, n.length ? n.map(function (t) {
          var i = statusIndex(t.status);
          return el('span', { className: 'tag ' + (STATUS_CLASS[i] || ''), title: '用途：' + (t.purposes || []).concat(t.purposeOther ? ['其他：' + t.purposeOther] : []).join('、'),
            text: t.name + '（' + t.frequency + '・' + t.status.replace('使用中－', '') + '）' });
        }) : [el('span', { className: 'updated', text: '不需要' })]);
        tags.dataset.cls = 'wrap';
        return [r.dept, r.name, tags, wrapCell(r.comment || ''), C.formatTime(r.time)];
      }), 99));
  }

  /* ---------- 匯出 CSV（Excel 可直接開啟） ---------- */
  function csvCell(v) {
    var s = String(v === undefined || v === null ? '' : v);
    if (/^\s*[=+\-@＝＋－＠|']/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }

  function exportCsv() {
    var lines = [['部門', '姓名', '工具', '是否為其他工具', '是否需要', '用途', '其他用途', '使用頻率', '目前使用狀況', '其他意見', '最後更新時間']];
    filtered().forEach(function (r) {
      (r.tools || []).forEach(function (t) {
        lines.push([r.dept, r.name, t.name, t.other ? '是' : '否', t.need ? '需要' : '不需要',
          (t.purposes || []).join('、'), t.purposeOther || '', t.frequency || '', t.status || '', r.comment || '', C.formatTime(r.time)]);
      });
    });
    var csv = String.fromCharCode(0xFEFF) + lines.map(function (l) { return l.map(csvCell).join(','); }).join('\r\n');
    var url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    var d = new Date();
    var stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    var a = el('a', { href: url, download: 'AI工具需求調查_' + ($('deptFilter').value || '全部') + '_' + stamp + '.csv' });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
})();
