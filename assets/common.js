/* 共用函式：建立 DOM（一律用 textContent，避免 XSS）、套用設定、呼叫後端 */
(function () {
  'use strict';
  var CFG = window.SURVEY_CONFIG || {};

  // el('div', { className: 'x', text: '...' }, [子元素...])
  function el(tag, props, children) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (v === undefined || v === null || v === false) return;
        if (k === 'text') node.textContent = v;
        else if (k === 'className') node.className = v;
        else if (k === 'dataset') Object.keys(v).forEach(function (d) { node.dataset[d] = v[d]; });
        else if (k === 'on') Object.keys(v).forEach(function (ev) { node.addEventListener(ev, v[ev]); });
        else if (v === true) node.setAttribute(k, '');
        else node.setAttribute(k, String(v));
      });
    }
    (children || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  // 把設定檔的公司名稱、發起單位等填入頁面
  function applyConfig() {
    document.querySelectorAll('[data-cfg]').forEach(function (n) {
      var v = CFG[n.getAttribute('data-cfg')];
      if (typeof v === 'string' && v) n.textContent = v;
    });
  }

  function apiReady() {
    return typeof CFG.apiUrl === 'string' && /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(CFG.apiUrl);
  }

  // 用 text/plain 送出，避免瀏覽器對 Apps Script 發出 CORS 預檢請求
  function callApi(payload) {
    if (!apiReady()) return Promise.reject(new Error('資料接收網址未設定或格式錯誤'));
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 30000) : null;
    return fetch(CFG.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
      credentials: 'omit',
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      if (!res.ok) throw new Error('伺服器回應錯誤（' + res.status + '）');
      return res.json();
    }).catch(function (err) {
      if (err && err.name === 'AbortError') throw new Error('連線逾時，請稍後再試');
      if (err instanceof SyntaxError) throw new Error('伺服器回應格式錯誤');
      throw err instanceof TypeError ? new Error('無法連線到伺服器，請確認網路後再試') : err;
    }).finally(function () {
      if (timer) clearTimeout(timer);
    });
  }

  function formatTime(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    function p(n) { return n < 10 ? '0' + n : String(n); }
    return d.getFullYear() + '/' + p(d.getMonth() + 1) + '/' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  window.SurveyCommon = { CFG: CFG, el: el, applyConfig: applyConfig, apiReady: apiReady, callApi: callApi, formatTime: formatTime };
})();
