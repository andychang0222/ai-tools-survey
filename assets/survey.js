/* 填答頁邏輯 */
(function () {
  'use strict';
  var C = window.SurveyCommon;
  var CFG = C.CFG;
  var el = C.el;

  var form = document.getElementById('surveyForm');
  var toolList = document.getElementById('toolList');
  var otherList = document.getElementById('otherList');
  var addOtherBtn = document.getElementById('addOther');
  var submitBtn = document.getElementById('submitBtn');
  var formError = document.getElementById('formError');
  var otherSeq = 0;
  var submitting = false;

  C.applyConfig();

  if (CFG.deadline) {
    document.getElementById('deadlineText').textContent = CFG.deadline;
    document.getElementById('deadlineRow').hidden = false;
  }

  if (!C.apiReady()) {
    document.getElementById('configAlert').hidden = false;
    submitBtn.disabled = true;
  }

  // 部門選單
  var deptSel = document.getElementById('dept');
  CFG.departments.forEach(function (d) {
    deptSel.appendChild(el('option', { value: d, text: d }));
  });

  // ---------- 建立工具卡片 ----------
  function radioGroup(name, values, className) {
    return el('div', { className: 'options ' + (className || ''), role: 'radiogroup' }, values.map(function (v) {
      return el('label', { className: 'opt' }, [el('input', { type: 'radio', name: name, value: v }), v]);
    }));
  }

  function detailBody(key) {
    var otherText = el('input', {
      type: 'text', className: 'opt-other-text', maxlength: '50',
      placeholder: '請說明其他用途', 'aria-label': '其他用途說明', dataset: { role: 'purposeOther' }
    });
    otherText.hidden = true;

    var otherChk = el('input', { type: 'checkbox', value: '__other__', dataset: { role: 'purpose' } });
    otherChk.addEventListener('change', function () {
      otherText.hidden = !otherChk.checked;
      if (otherChk.checked) otherText.focus();
    });

    var purposeOpts = CFG.purposes.map(function (p) {
      return el('label', { className: 'opt' }, [el('input', { type: 'checkbox', value: p, dataset: { role: 'purpose' } }), p]);
    });
    purposeOpts.push(el('label', { className: 'opt' }, [otherChk, '其他']));

    return el('div', { className: 'tool-body' }, [
      el('div', { className: 'field', dataset: { group: 'purpose' } }, [
        el('span', { className: 'label' }, ['主要用途', el('span', { className: 'req', text: '*' }), el('span', { className: 'hint', text: '可複選' })]),
        el('div', { className: 'options' }, purposeOpts),
        otherText
      ]),
      el('div', { className: 'field', dataset: { group: 'frequency' } }, [
        el('span', { className: 'label' }, ['預計使用頻率', el('span', { className: 'req', text: '*' })]),
        radioGroup(key + '_freq', CFG.frequencies, 'inline')
      ]),
      el('div', { className: 'field', dataset: { group: 'status' } }, [
        el('span', { className: 'label' }, ['目前是否已在使用', el('span', { className: 'req', text: '*' })]),
        radioGroup(key + '_status', CFG.statuses, 'inline')
      ])
    ]);
  }

  function fixedToolCard(tool) {
    var key = 't_' + tool.id;
    var body = detailBody(key);
    body.hidden = true;

    var card = el('div', { className: 'tool', dataset: { toolId: tool.id, key: key } });
    var seg = el('div', { className: 'seg', role: 'radiogroup', 'aria-label': tool.name + ' 是否需要' }, [
      el('input', { type: 'radio', name: key + '_need', id: key + '_y', value: 'yes' }),
      el('label', { 'for': key + '_y', text: '需要' }),
      el('input', { type: 'radio', name: key + '_need', id: key + '_n', value: 'no' }),
      el('label', { 'for': key + '_n', text: '不需要' })
    ]);
    seg.addEventListener('change', function () {
      var need = seg.querySelector('input:checked').value === 'yes';
      body.hidden = !need;
      card.classList.toggle('is-needed', need);
      seg.classList.remove('invalid');
    });

    card.appendChild(el('div', { className: 'tool-head' }, [
      el('div', null, [
        el('div', { className: 'tool-name', text: tool.name }),
        el('div', { className: 'tool-vendor', text: tool.vendor })
      ]),
      seg
    ]));
    card.appendChild(body);
    return card;
  }

  function otherToolCard() {
    otherSeq += 1;
    var key = 'o_' + otherSeq;
    var card = el('div', { className: 'tool is-needed', dataset: { toolId: 'other', key: key } });
    var nameInput = el('input', {
      type: 'text', maxlength: '40', placeholder: '工具名稱，例如：Perplexity、NotebookLM',
      'aria-label': '其他工具名稱', dataset: { role: 'otherName' }
    });
    var removeBtn = el('button', { type: 'button', className: 'tool-remove', text: '移除' });
    removeBtn.addEventListener('click', function () {
      card.remove();
      refreshAddBtn();
    });
    card.appendChild(el('div', { className: 'tool-head' }, [
      el('div', { className: 'grow' }, [
        el('div', { className: 'tool-vendor', text: '其他 AI 工具' }),
        nameInput
      ]),
      removeBtn
    ]));
    card.appendChild(detailBody(key));
    return card;
  }

  function refreshAddBtn() {
    addOtherBtn.disabled = otherList.children.length >= (CFG.maxOtherTools || 5);
  }

  CFG.tools.forEach(function (t) { toolList.appendChild(fixedToolCard(t)); });
  addOtherBtn.addEventListener('click', function () {
    if (otherList.children.length >= (CFG.maxOtherTools || 5)) return;
    var card = otherToolCard();
    otherList.appendChild(card);
    card.querySelector('[data-role="otherName"]').focus();
    refreshAddBtn();
  });

  // 使用者修正後清除錯誤標示
  form.addEventListener('input', function (e) {
    e.target.classList.remove('invalid');
    var g = e.target.closest('[data-group]');
    if (g) g.classList.remove('group-invalid');
  });
  form.addEventListener('change', function (e) {
    var g = e.target.closest('[data-group]');
    if (g) g.classList.remove('group-invalid');
    e.target.classList.remove('invalid');
  });

  // ---------- 收集與驗證 ----------
  function readDetail(card, key, errors, label) {
    var purposes = [];
    var purposeOther = '';
    card.querySelectorAll('[data-role="purpose"]:checked').forEach(function (c) {
      if (c.value === '__other__') purposeOther = 'pending';
      else purposes.push(c.value);
    });
    var otherInput = card.querySelector('[data-role="purposeOther"]');
    var purposeGroup = card.querySelector('[data-group="purpose"]');
    if (purposeOther) {
      purposeOther = otherInput.value.trim();
      if (!purposeOther) {
        otherInput.classList.add('invalid');
        errors.push({ node: otherInput, msg: label + '：請說明「其他」用途' });
      }
    }
    if (!purposes.length && !purposeOther && !card.querySelector('[data-role="purpose"][value="__other__"]:checked')) {
      purposeGroup.classList.add('group-invalid');
      errors.push({ node: purposeGroup, msg: label + '：請至少勾選一項用途' });
    }

    function radio(name, group, msg) {
      var c = card.querySelector('input[name="' + name + '"]:checked');
      if (!c) {
        var g = card.querySelector('[data-group="' + group + '"]');
        g.classList.add('group-invalid');
        errors.push({ node: g, msg: label + '：' + msg });
        return '';
      }
      return c.value;
    }
    return {
      need: true,
      purposes: purposes,
      purposeOther: purposeOther,
      frequency: radio(key + '_freq', 'frequency', '請選擇使用頻率'),
      status: radio(key + '_status', 'status', '請選擇目前使用狀況')
    };
  }

  function collect() {
    var errors = [];
    var dept = deptSel.value;
    var nameEl = document.getElementById('name');
    var name = nameEl.value.replace(/\s+/g, ' ').trim();

    if (!dept) { deptSel.classList.add('invalid'); errors.push({ node: deptSel, msg: '請選擇部門' }); }
    if (!name) { nameEl.classList.add('invalid'); errors.push({ node: nameEl, msg: '請填寫姓名' }); }

    var tools = [];
    toolList.querySelectorAll('.tool').forEach(function (card) {
      var id = card.dataset.toolId;
      var key = card.dataset.key;
      var tool = CFG.tools.filter(function (t) { return t.id === id; })[0];
      var needInput = card.querySelector('input[name="' + key + '_need"]:checked');
      if (!needInput) {
        var seg = card.querySelector('.seg');
        seg.classList.add('invalid');
        errors.push({ node: seg, msg: tool.name + '：請選擇「需要」或「不需要」' });
        return;
      }
      if (needInput.value === 'no') {
        tools.push({ id: id, name: tool.name, other: false, need: false });
        return;
      }
      var d = readDetail(card, key, errors, tool.name);
      d.id = id; d.name = tool.name; d.other = false;
      tools.push(d);
    });

    var nameKey = function (s) { return s.replace(/\s+/g, '').toLowerCase(); };
    var usedNames = {};
    CFG.tools.forEach(function (t) { usedNames[nameKey(t.name)] = 'builtin'; });
    otherList.querySelectorAll('.tool').forEach(function (card, i) {
      var nameInput = card.querySelector('[data-role="otherName"]');
      var toolName = nameInput.value.replace(/\s+/g, ' ').trim();
      var label = toolName || ('其他工具 ' + (i + 1));
      var k = nameKey(toolName);
      if (!toolName) {
        nameInput.classList.add('invalid');
        errors.push({ node: nameInput, msg: label + '：請填寫工具名稱（不需要的話請按「移除」）' });
      } else if (usedNames[k]) {
        nameInput.classList.add('invalid');
        errors.push({ node: nameInput, msg: usedNames[k] === 'builtin'
          ? label + '：已列在上方工具中，請直接在上方選擇，並移除這一項'
          : label + '：重複填寫，請移除其中一項' });
      }
      if (k) usedNames[k] = usedNames[k] || 'other';
      var d = readDetail(card, card.dataset.key, errors, label);
      d.id = 'other'; d.name = toolName; d.other = true;
      tools.push(d);
    });

    return {
      errors: errors,
      data: {
        dept: dept,
        name: name,
        website: document.getElementById('website').value,
        comment: document.getElementById('comment').value.trim(),
        tools: tools
      }
    };
  }

  function showErrors(errors) {
    formError.textContent = '';
    formError.appendChild(el('strong', { text: '還有 ' + errors.length + ' 個地方需要填寫：' }));
    formError.appendChild(el('ul', null, errors.slice(0, 8).map(function (e) { return el('li', { text: e.msg }); })));
    formError.hidden = false;
    var first = errors[0].node;
    first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (typeof first.focus === 'function' && /INPUT|SELECT|TEXTAREA/.test(first.tagName)) first.focus({ preventScroll: true });
  }

  function showDone(data, res) {
    form.hidden = true;
    var view = document.getElementById('doneView');
    var updated = res && res.updated;
    document.getElementById('doneText').textContent =
      data.dept + ' ' + data.name + '，您的填答已' + (updated ? '更新' : '送出') +
      (res && res.time ? '（' + C.formatTime(res.time) + '）' : '') + '。以下是您的需求摘要：';
    var list = document.getElementById('doneSummary');
    list.textContent = '';
    var needed = data.tools.filter(function (t) { return t.need; });
    if (!needed.length) {
      list.appendChild(el('li', { text: '目前沒有需要的 AI 工具。' }));
    }
    needed.forEach(function (t) {
      var uses = t.purposes.slice();
      if (t.purposeOther) uses.push('其他：' + t.purposeOther);
      list.appendChild(el('li', null, [
        el('strong', { text: t.name }),
        '　' + t.frequency + '・' + t.status,
        el('br'),
        el('span', { className: 'hint', text: '用途：' + uses.join('、') })
      ]));
    });
    view.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.getElementById('againBtn').addEventListener('click', function () {
    document.getElementById('doneView').hidden = true;
    form.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (submitting || !C.apiReady()) return;
    formError.hidden = true;
    var r = collect();
    if (r.errors.length) { showErrors(r.errors); return; }

    submitting = true;
    submitBtn.disabled = true;
    submitBtn.textContent = '送出中…';
    C.callApi({ action: 'submit', data: r.data }).then(function (res) {
      if (!res || !res.ok) throw new Error((res && res.error) || '送出失敗，請稍後再試');
      showDone(r.data, res);
    }).catch(function (err) {
      formError.textContent = '送出失敗：' + err.message;
      formError.hidden = false;
      formError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }).finally(function () {
      submitting = false;
      submitBtn.disabled = false;
      submitBtn.textContent = '送出問卷';
    });
  });
})();
