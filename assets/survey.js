/* 填答頁：依 SurveySchema 產生問卷、即時顯示條件題、計算進度、送出 */
(function () {
  'use strict';
  var C = window.SurveyCommon;
  var S = window.SurveySchema;
  var CFG = C.CFG;
  var el = C.el;
  var $ = function (id) { return document.getElementById(id); };

  var form = $('surveyForm');
  var sectionsEl = $('sections');
  var submitBtn = $('submitBtn');
  var attempted = false;   // 按過送出後才即時顯示錯誤
  var submitting = false;
  var otherSeq = 0;
  var lastVisible = {};    // 題目上一次是否可見（用來做出現動畫）

  C.applyConfig();
  if (CFG.deadline) { $('deadlineText').textContent = CFG.deadline; $('deadlineRow').hidden = false; }
  if (!C.apiReady()) { $('configAlert').hidden = false; submitBtn.disabled = true; }

  /* ================= 產生問卷 ================= */

  function choice(type, name, value, text) {
    var input = el('input', { type: type, name: name, value: value });
    return el('label', { className: 'choice' + (type === 'radio' ? ' is-radio' : '') }, [
      input, el('span', { className: 'mark', 'aria-hidden': 'true' }), el('span', { text: text })
    ]);
  }

  function isCompact(options) {
    return options.every(function (o) { return o.length <= 9; }) && options.length <= 6;
  }

  function buildQuestion(q) {
    var labelId = 'lbl-' + q.id;
    var head = el('div', { className: 'q-head' }, [
      el('span', { className: 'q-no', 'aria-hidden': 'true' }),
      el(q.type === 'select' || q.type === 'text' || q.type === 'textarea' ? 'label' : 'span',
        { className: 'q-label', id: labelId, 'for': (q.type === 'select' || q.type === 'text' || q.type === 'textarea') ? 'f-' + q.id : null },
        [q.label, q.required ? el('span', { className: 'q-req', 'aria-hidden': 'true', text: '*' }) : null]),
      q.hint ? el('span', { className: 'q-hint', text: q.hint }) : null
    ]);

    var body;
    if (q.type === 'select') {
      var sel = el('select', { id: 'f-' + q.id, name: q.id, required: q.required }, [el('option', { value: '', text: '請選擇' })]);
      q.options.forEach(function (o) { sel.appendChild(el('option', { value: o, text: o })); });
      body = sel;
    } else if (q.type === 'text') {
      body = el('input', { type: 'text', id: 'f-' + q.id, name: q.id, maxlength: q.max, placeholder: q.placeholder, autocomplete: q.id === 'name' ? 'name' : 'off' });
    } else if (q.type === 'textarea') {
      body = el('textarea', { id: 'f-' + q.id, name: q.id, maxlength: q.max, placeholder: q.placeholder });
    } else if (q.type === 'radio' || q.type === 'checkbox') {
      var type = q.type;
      var box = el('div', { className: 'choices' + (isCompact(q.options) ? ' compact' : ''), role: type === 'radio' ? 'radiogroup' : 'group', 'aria-labelledby': labelId },
        q.options.map(function (o) { return choice(type, q.id, o, o); }));
      var parts = [box];
      if (q.other) {
        box.appendChild(choice('checkbox', q.id, '__other__', '其他'));
        var otherInput = el('input', { type: 'text', className: 'other-input', maxlength: '50', placeholder: '請說明', 'aria-label': q.short + '：其他（請說明）', dataset: { otherFor: q.id } });
        otherInput.hidden = true;
        parts.push(otherInput);
      }
      body = el('div', null, parts);
    } else if (q.type === 'tools') {
      body = buildTools(labelId);
    }

    var wrap = el('div', { className: 'q', id: 'q-' + q.id, dataset: { q: q.id } }, [
      head,
      el('div', { className: 'q-body' }, [body]),
      el('p', { className: 'q-error', id: 'err-' + q.id, hidden: true })
    ]);
    return wrap;
  }

  /* ---------- 工具選擇與明細 ---------- */
  var toolPanels;

  function buildTools(labelId) {
    var grid = el('div', { className: 'tool-grid', role: 'group', 'aria-labelledby': labelId }, S.TOOLS.map(function (t) {
      var input = el('input', { type: 'checkbox', value: t.id, dataset: { tool: t.id } });
      input.addEventListener('change', function () {
        if (input.checked) addPanel(t, false); else removePanel(t.id);
      });
      return el('label', { className: 'tool-tile' }, [input,
        el('span', { className: 'tt-name', text: t.name }),
        el('span', { className: 'tt-vendor', text: t.vendor })]);
    }));
    var addBtn = el('button', { type: 'button', className: 'add-other', id: 'addOther', text: '＋ 使用其他 AI 工具' });
    addBtn.addEventListener('click', function () {
      if (otherCount() >= S.MAX_OTHER_TOOLS) return;
      var p = addPanel(null, true);
      p.querySelector('[data-role="otherName"]').focus();
    });
    toolPanels = el('div', { className: 'tool-panels' });
    return el('div', null, [grid, addBtn, toolPanels]);
  }

  function otherCount() { return toolPanels.querySelectorAll('[data-other="1"]').length; }

  function panelField(key, field, label, options) {
    var name = 'tp-' + key + '-' + field;
    return el('div', { className: 'tp-field', dataset: { field: field } }, [
      el('div', { className: 'tp-field-label', id: name + '-lbl', text: label }),
      el('div', { className: 'choices compact', role: 'radiogroup', 'aria-labelledby': name + '-lbl' },
        options.map(function (o) { return choice('radio', name, o, o); }))
    ]);
  }

  function addPanel(def, isOther) {
    var key = isOther ? 'o' + (++otherSeq) : def.id;
    var head;
    if (isOther) {
      var nameInput = el('input', { type: 'text', maxlength: '40', placeholder: '工具名稱，例如 Perplexity、NotebookLM', 'aria-label': '其他 AI 工具名稱', dataset: { role: 'otherName' } });
      var rm = el('button', { type: 'button', className: 'tp-remove', text: '移除' });
      head = el('div', { className: 'tp-head' }, [nameInput, rm]);
    } else {
      head = el('div', { className: 'tp-head' }, [el('span', { className: 'tp-name', text: def.name })]);
    }
    var payer = panelField(key, 'payer', '費用由誰支付', S.PAYERS);
    payer.hidden = true;
    var panel = el('div', { className: 'tool-panel is-new', dataset: { key: key, tool: isOther ? 'other' : def.id, other: isOther ? '1' : '0' } }, [
      head,
      el('div', { className: 'tp-body' }, [
        panelField(key, 'plan', '使用的方案', isOther ? S.OTHER_PLANS : def.plans),
        payer,
        panelField(key, 'account', '用哪個帳號登入', S.ACCOUNTS),
        panelField(key, 'frequency', '使用頻率', S.TOOL_FREQ)
      ])
    ]);
    if (isOther) {
      head.querySelector('.tp-remove').addEventListener('click', function () { panel.remove(); update(); });
    }
    // 固定工具依畫面順序排列，其他工具排在最後
    if (!isOther) {
      var order = S.TOOLS.map(function (t) { return t.id; });
      var next = Array.prototype.filter.call(toolPanels.children, function (p) {
        return p.dataset.other === '1' || order.indexOf(p.dataset.tool) > order.indexOf(def.id);
      })[0];
      toolPanels.insertBefore(panel, next || null);
    } else {
      toolPanels.appendChild(panel);
    }
    update();
    return panel;
  }

  function removePanel(id) {
    var p = toolPanels.querySelector('[data-tool="' + id + '"]');
    if (p) p.remove();
    update();
  }

  /* ---------- 建立各區段與進度欄 ---------- */
  var stepsEl = $('steps');
  S.SECTIONS.forEach(function (sec, i) {
    var children = [
      el('h2', null, [el('span', { className: 'sec-no', text: String(i + 1) }), sec.title]),
      el('p', { className: 'sec-desc', text: sec.desc })
    ];
    // 部門與姓名並排
    if (sec.id === 'basic') {
      children.push(el('div', { className: 'field-row' }, [buildQuestion(sec.questions[0]), buildQuestion(sec.questions[1])]));
      sec.questions.slice(2).forEach(function (q) { children.push(buildQuestion(q)); });
    } else {
      sec.questions.forEach(function (q) { children.push(buildQuestion(q)); });
    }
    sectionsEl.appendChild(el('section', { className: 'sec', id: 'sec-' + sec.id, 'aria-labelledby': 'h-' + sec.id }, children));
    children[0].id = 'h-' + sec.id;

    stepsEl.appendChild(el('li', { id: 'step-' + sec.id }, [
      el('a', { href: '#sec-' + sec.id }, [
        el('span', { className: 'step-no', text: String(i + 1) }),
        el('span', { text: sec.title }),
        el('span', { className: 'step-count' })
      ])
    ]));
  });

  /* ================= 互動 ================= */

  // 「其他」勾選時顯示說明欄；互斥選項（例如「目前不需要」）會取消其他勾選
  form.addEventListener('change', function (e) {
    var t = e.target;
    if (t.type === 'checkbox' && t.name) {
      var q = findQ(t.name);
      if (q && q.exclusive) {
        var boxes = form.querySelectorAll('input[name="' + t.name + '"]');
        if (t.checked && t.value === q.exclusive) {
          boxes.forEach(function (b) { if (b !== t) b.checked = false; });
        } else if (t.checked) {
          boxes.forEach(function (b) { if (b.value === q.exclusive) b.checked = false; });
        }
      }
      if (q && q.other) {
        var oi = form.querySelector('[data-other-for="' + t.name + '"]');
        var on = !!form.querySelector('input[name="' + t.name + '"][value="__other__"]:checked');
        oi.hidden = !on;
        if (on && t.value === '__other__') oi.focus();
      }
    }
    update();
  });
  form.addEventListener('input', function (e) { if (e.target.type === 'text' || e.target.tagName === 'TEXTAREA') update(); });

  function findQ(id) {
    for (var i = 0; i < S.SECTIONS.length; i++) {
      for (var j = 0; j < S.SECTIONS[i].questions.length; j++) {
        if (S.SECTIONS[i].questions[j].id === id) return S.SECTIONS[i].questions[j];
      }
    }
    return null;
  }

  /* ---------- 收集填答 ---------- */
  function radioVal(name) {
    var c = form.querySelector('input[name="' + name + '"]:checked');
    return c ? c.value : '';
  }

  function collect() {
    var raw = { schemaVersion: S.version, website: $('website').value };
    var panelKeys = [];
    S.SECTIONS.forEach(function (sec) {
      sec.questions.forEach(function (q) {
        if (q.type === 'select' || q.type === 'text' || q.type === 'textarea') {
          raw[q.id] = $('f-' + q.id).value;
        } else if (q.type === 'radio') {
          raw[q.id] = radioVal(q.id);
        } else if (q.type === 'checkbox') {
          raw[q.id] = Array.prototype.map.call(form.querySelectorAll('input[name="' + q.id + '"]:checked'), function (c) { return c.value; })
            .filter(function (v) { return v !== '__other__'; });
          if (q.other) {
            var on = !!form.querySelector('input[name="' + q.id + '"][value="__other__"]:checked');
            raw[q.id + 'Other'] = on ? form.querySelector('[data-other-for="' + q.id + '"]').value : '';
          }
        } else if (q.type === 'tools') {
          raw.tools = Array.prototype.map.call(toolPanels.children, function (p) {
            var key = p.dataset.key;
            panelKeys.push(p);
            var isOther = p.dataset.other === '1';
            return {
              id: isOther ? 'other' : p.dataset.tool,
              other: isOther,
              name: isOther ? p.querySelector('[data-role="otherName"]').value : '',
              plan: radioVal('tp-' + key + '-plan'),
              payer: radioVal('tp-' + key + '-payer'),
              account: radioVal('tp-' + key + '-account'),
              frequency: radioVal('tp-' + key + '-frequency')
            };
          });
        }
      });
    });
    return { raw: raw, panels: panelKeys };
  }

  /* ---------- 依驗證結果更新畫面 ---------- */
  var lastResult = null;

  function update() {
    var c = collect();
    var r = S.validate(c.raw);
    lastResult = { raw: c.raw, panels: c.panels, result: r };

    // 選取狀態
    form.querySelectorAll('.choice').forEach(function (l) { l.classList.toggle('on', l.querySelector('input').checked); });
    form.querySelectorAll('.tool-tile').forEach(function (l) { l.classList.toggle('on', l.querySelector('input').checked); });

    // 付費方案才顯示「費用由誰支付」
    Array.prototype.forEach.call(toolPanels.children, function (p) {
      var plan = radioVal('tp-' + p.dataset.key + '-plan');
      var payer = p.querySelector('[data-field="payer"]');
      var show = S.isPaidPlan(plan);
      if (!show) payer.querySelectorAll('input').forEach(function (i) { i.checked = false; });
      payer.hidden = !show;
    });
    $('addOther').disabled = otherCount() >= S.MAX_OTHER_TOOLS;

    // 條件題顯示、題號、進度
    var no = 0, total = 0, done = 0;
    r.sections.forEach(function (s) {
      $('sec-' + s.id).hidden = !s.visible;
      s.questions.forEach(function (qs) {
        var node = $('q-' + qs.id);
        node.hidden = !qs.visible;
        if (qs.visible) {
          node.querySelector('.q-no').textContent = (++no) + '.';
          if (lastVisible[qs.id] === false) {
            node.classList.remove('is-new'); void node.offsetWidth; node.classList.add('is-new');
          }
        }
        lastVisible[qs.id] = qs.visible;
      });
      total += s.visible ? s.total : 0;
      done += s.visible ? s.done : 0;

      var step = $('step-' + s.id);
      step.classList.toggle('is-skip', !s.visible);
      step.classList.toggle('is-done', s.visible && s.total > 0 && s.done === s.total);
      step.querySelector('.step-count').textContent = s.visible ? s.done + '／' + s.total : '免填';
    });

    $('mpText').textContent = '已完成 ' + done + '／' + total + ' 題';
    $('mpFill').style.width = (total ? (done / total) * 100 : 0) + '%';
    $('submitStatus').textContent = done === total ? '都填好了，可以送出。' : '還有 ' + (total - done) + ' 題必填未完成';

    if (attempted) showErrors(r.errors, c.panels, false);
  }

  function showErrors(errors, panels, scroll) {
    form.querySelectorAll('.q.has-error').forEach(function (n) { n.classList.remove('has-error'); });
    form.querySelectorAll('.q-error').forEach(function (n) { n.hidden = true; n.textContent = ''; });
    form.querySelectorAll('.tp-field.has-error').forEach(function (n) { n.classList.remove('has-error'); });
    form.querySelectorAll('input.invalid').forEach(function (n) { n.classList.remove('invalid'); });

    var firstNode = null;
    errors.forEach(function (e) {
      var q = $('q-' + e.id);
      if (!q) return;
      q.classList.add('has-error');
      var target = q;
      if (e.tool) {
        var panel = e.tool.indexOf('other') === 0 ? panels[Number(e.tool.slice(5))] : toolPanels.querySelector('[data-tool="' + e.tool + '"]');
        if (panel) {
          if (e.field === 'name') { var ni = panel.querySelector('[data-role="otherName"]'); ni.classList.add('invalid'); target = ni; }
          else { var f = panel.querySelector('[data-field="' + e.field + '"]'); if (f) { f.classList.add('has-error'); target = f; } }
        }
      }
      var box = $('err-' + e.id);
      if (!box.textContent) { box.textContent = e.msg; box.hidden = false; }
      if (!firstNode) firstNode = target;
    });

    var eb = $('errorBox');
    if (errors.length) {
      eb.textContent = '';
      eb.appendChild(el('strong', { text: '還有 ' + errors.length + ' 個地方需要填寫或修正：' }));
      eb.appendChild(el('ul', null, errors.slice(0, 6).map(function (e) { return el('li', { text: e.msg }); })));
      eb.hidden = false;
    } else {
      eb.hidden = true;
    }
    if (scroll && firstNode) {
      firstNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var focusable = firstNode.matches && firstNode.matches('input, select, textarea') ? firstNode : firstNode.querySelector('input:not([type="hidden"]), select, textarea');
      if (focusable) focusable.focus({ preventScroll: true });
    }
  }

  /* ---------- 送出 ---------- */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (submitting || !C.apiReady()) return;
    attempted = true;
    update();
    var r = lastResult.result;
    if (r.errors.length) { showErrors(r.errors, lastResult.panels, true); return; }

    submitting = true;
    submitBtn.disabled = true;
    submitBtn.textContent = '送出中…';
    var data = r.data;
    C.callApi({ action: 'submit', data: lastResult.raw }).then(function (res) {
      if (!res || !res.ok) throw new Error((res && res.error) || '送出失敗，請稍後再試');
      showDone(data, res);
    }).catch(function (err) {
      var eb = $('errorBox');
      eb.textContent = '送出失敗：' + err.message;
      eb.hidden = false;
      eb.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }).finally(function () {
      submitting = false;
      submitBtn.disabled = false;
      submitBtn.textContent = '送出問卷';
    });
  });

  function showDone(d, res) {
    form.hidden = true;
    $('doneText').textContent = d.dept + ' ' + d.name + '，你的填答已' + (res.updated ? '更新' : '送出') +
      (res.time ? '（' + C.formatTime(res.time) + '）' : '') + '。如需修改，按下方「修改填答」重新送出即可。';
    var sum = $('doneSummary');
    sum.textContent = '';
    function row(k, v) { sum.appendChild(el('dt', { text: k })); sum.appendChild(el('dd', { text: v || '—' })); }
    row('目前使用情況', d.usage);
    if (d.tools.length) row('使用中的工具', d.tools.map(function (t) { return t.name + '（' + t.plan + '）'; }).join('、'));
    row('希望公司提供', d.wantTools.concat(d.wantToolsOther ? [d.wantToolsOther] : []).join('、'));
    row('希望的支援', d.support.concat(d.supportOther ? [d.supportOther] : []).join('、'));
    $('doneView').hidden = false;
    $('doneView').focus({ preventScroll: true });
    $('doneView').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  $('againBtn').addEventListener('click', function () {
    $('doneView').hidden = true;
    form.hidden = false;
    $('sec-basic').scrollIntoView({ behavior: 'smooth' });
  });

  /* ---------- 進度欄標示目前區段 ---------- */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var id = en.target.id.replace('sec-', '');
        stepsEl.querySelectorAll('li').forEach(function (li) { li.classList.toggle('is-current', li.id === 'step-' + id); });
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    sectionsEl.querySelectorAll('.sec').forEach(function (s) { io.observe(s); });
  }

  update();
})();
