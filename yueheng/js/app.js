/* 月衡 · 界面逻辑 */
(function () {
  'use strict';

  var S = window.Store;
  var F = window.Finance;

  var DEMO = /[?&]demo=1(?:&|$)/.test(window.location.search);
  var state = DEMO ? S.demoState() : S.load();

  var view = 'overview';
  var listOffset = 0;
  var lastCat = 'food';
  var modalCb = null;
  var toastTimer = null;

  var entry = {
    amount: '0',
    category: 'food',
    note: '',
    date: F.keyOf(new Date())
  };

  var el = {
    view: document.getElementById('view'),
    topMonth: document.getElementById('topMonth'),
    sheetRoot: document.getElementById('sheetRoot'),
    amtVal: document.getElementById('amtVal'),
    catRow: document.getElementById('catRow'),
    noteInput: document.getElementById('noteInput'),
    dateInput: document.getElementById('dateInput'),
    dateChipLabel: document.getElementById('dateChipLabel'),
    saveBtn: document.getElementById('saveBtn'),
    modalRoot: document.getElementById('modalRoot'),
    toast: document.getElementById('toast')
  };

  var WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  /* ---------------- 小工具 ---------------- */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function group3(intStr) {
    return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function money(n) {
    var v = Math.round((Number(n) || 0) * 100) / 100;
    var neg = v < 0;
    v = Math.abs(v);
    var parts = v.toFixed(2).split('.');
    var out = group3(parts[0]);
    if (parts[1] !== '00') out += '.' + parts[1];
    return (neg ? '-' : '') + out;
  }

  function heroParts(n) {
    var v = Math.abs(Math.round((Number(n) || 0) * 100) / 100);
    var parts = v.toFixed(2).split('.');
    return { int: group3(parts[0]), cents: parts[1] === '00' ? '' : parts[1] };
  }

  function dayLabel(dateStr) {
    var d = F.parseKey(dateStr);
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var diff = Math.round((today - d) / 86400000);
    var base = diff === 0 ? '今天' : diff === 1 ? '昨天' : (d.getMonth() + 1) + '月' + d.getDate() + '日';
    return base + ' · ' + WEEK[d.getDay()];
  }

  function persist() {
    if (!DEMO) S.save(state);
  }

  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.classList.remove('is-show'); }, 1900);
  }

  function showModal(opts) {
    var body = opts.body ? '<div class="modal-body">' + opts.body + '</div>' : '';
    var cancel = opts.cancelText === false ? '' :
      '<button class="modal-btn" type="button" data-action="modal-cancel">' + (opts.cancelText || '取消') + '</button>';
    el.modalRoot.innerHTML =
      '<div class="modal-mask" data-action="modal-cancel"></div>' +
      '<div class="modal" role="dialog" aria-modal="true">' +
        '<div class="modal-title">' + esc(opts.title) + '</div>' + body +
        '<div class="modal-actions">' + cancel +
          '<button class="modal-btn ' + (opts.danger ? 'is-danger' : 'is-primary') + '" type="button" data-action="modal-ok">' +
          esc(opts.okText || '好') + '</button>' +
        '</div>' +
      '</div>';
    modalCb = opts.onOk || null;
    el.modalRoot.classList.add('is-open');
    el.modalRoot.setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    el.modalRoot.classList.remove('is-open');
    el.modalRoot.setAttribute('aria-hidden', 'true');
    el.modalRoot.innerHTML = '';
    modalCb = null;
  }

  /* ---------------- 记账面板 ---------------- */

  function openSheet() {
    entry.amount = '0';
    entry.category = lastCat;
    el.noteInput.value = '';
    el.dateInput.max = F.keyOf(new Date());
    setEntryDate(F.keyOf(new Date()));
    renderCats();
    renderAmount();
    el.sheetRoot.classList.add('is-open');
    el.sheetRoot.setAttribute('aria-hidden', 'false');
  }

  function closeSheet() {
    el.sheetRoot.classList.remove('is-open');
    el.sheetRoot.setAttribute('aria-hidden', 'true');
  }

  function renderCats() {
    var html = '';
    for (var i = 0; i < S.CATEGORIES.length; i++) {
      var c = S.CATEGORIES[i];
      html += '<button class="cat' + (c.id === entry.category ? ' is-on' : '') + '" type="button" data-cat="' + c.id + '">' +
        '<span class="ci">' + c.icon + '</span><span>' + c.name + '</span></button>';
    }
    el.catRow.innerHTML = html;
  }

  function renderAmount() {
    el.amtVal.textContent = entry.amount;
    el.amtVal.classList.toggle('is-zero', entry.amount === '0');
    el.saveBtn.disabled = !(Number(entry.amount) > 0);
  }

  function pressKey(k) {
    var a = entry.amount;
    if (k === 'del') {
      a = a.length > 1 ? a.slice(0, -1) : '0';
    } else if (k === '.') {
      if (a.indexOf('.') < 0) a += '.';
    } else {
      var dot = a.indexOf('.');
      if (a === '0') {
        a = k;
      } else if (dot >= 0) {
        if (a.length - dot > 2) return;
        a += k;
      } else {
        if (a.length >= 7) return;
        a += k;
      }
    }
    entry.amount = a;
    renderAmount();
  }

  function setEntryDate(dateStr) {
    entry.date = dateStr;
    var t = F.keyOf(new Date());
    var y = F.keyOf(new Date(Date.now() - 86400000));
    var cT = document.querySelector('[data-date="today"]');
    var cY = document.querySelector('[data-date="yesterday"]');
    var cD = document.querySelector('.chip--date');
    if (cT) cT.classList.toggle('is-on', dateStr === t);
    if (cY) cY.classList.toggle('is-on', dateStr === y);
    if (cD) cD.classList.toggle('is-on', dateStr !== t && dateStr !== y);
    el.dateChipLabel.textContent = (dateStr === t || dateStr === y)
      ? '选日期'
      : (Number(dateStr.slice(5, 7)) + '月' + Number(dateStr.slice(8, 10)) + '日');
    if (el.dateInput.value !== dateStr) el.dateInput.value = dateStr;
  }

  function saveTxn() {
    var amt = Number(entry.amount);
    if (!(amt > 0)) return;
    var t = S.addTxn(state, {
      amount: amt,
      category: entry.category,
      note: el.noteInput.value.trim(),
      date: entry.date
    });
    if (!t) { toast('金额不对'); return; }
    lastCat = entry.category;
    persist();
    closeSheet();
    render();
    toast('已记下 ¥' + money(amt));
  }

  function deleteTxn(id) {
    var t = null;
    for (var i = 0; i < state.txns.length; i++) if (state.txns[i].id === id) t = state.txns[i];
    if (!t) return;
    var c = S.catOf(t.category);
    showModal({
      title: '删除这笔记录？',
      body: esc(c.icon + ' ' + (t.note || c.name)) + '<br>¥' + money(t.amount),
      okText: '删除',
      danger: true,
      onOk: function () {
        S.removeTxn(state, id);
        persist();
        render();
        toast('已删除');
      }
    });
  }

  /* ---------------- 视图：概览 ---------------- */

  function chartSVG(s) {
    var W = 320, H = 128, padL = 4, padR = 4, padT = 8, padB = 16;
    var iw = W - padL - padR, ih = H - padT - padB;
    var D = s.daysInMonth;
    var maxV = Math.max(s.limit || 0, s.forecastHigh || 0, s.spent || 0, 1) * 1.08;

    function X(day) { return D <= 1 ? padL + iw / 2 : padL + ((day - 1) / (D - 1)) * iw; }
    function Y(v) { return padT + ih - Math.min(Math.max(v, 0) / maxV, 1) * ih; }
    function path(pts) {
      if (!pts.length) return '';
      var d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
      for (var i = 1; i < pts.length; i++) d += 'L' + pts[i][0].toFixed(1) + ' ' + pts[i][1].toFixed(1);
      return d;
    }

    var actual = [], proj = [], ideal = [];
    for (var i = 0; i < s.series.length; i++) {
      var p = s.series[i];
      // 从第一笔记录那天画起，避免把「还没开始记」误画成「没花钱」
      if (p.actual != null && p.day >= s.firstDay) actual.push([X(p.day), Y(p.actual)]);
      if (p.projected != null) proj.push([X(p.day), Y(p.projected)]);
      ideal.push([X(p.day), Y(p.ideal)]);
    }

    var area = '';
    if (actual.length > 1) {
      area = '<path d="' + path(actual) +
        'L' + actual[actual.length - 1][0].toFixed(1) + ' ' + (padT + ih) +
        'L' + actual[0][0].toFixed(1) + ' ' + (padT + ih) + 'Z" fill="url(#gArea)"/>';
    }

    var limitLine = '';
    if (s.limit > 0 && s.limit <= maxV) {
      var yl = Y(s.limit).toFixed(1);
      limitLine = '<line x1="' + padL + '" y1="' + yl + '" x2="' + (W - padR) + '" y2="' + yl +
        '" stroke="#E5484D" stroke-width="1" stroke-dasharray="1 4" stroke-linecap="round" opacity=".6"/>';
    }

    var dot = '';
    if (s.hasData) {
      dot = '<circle cx="' + X(s.today).toFixed(1) + '" cy="' + Y(s.spent).toFixed(1) +
        '" r="3.6" fill="#fff" stroke="#4C6FFF" stroke-width="2.2"/>';
    }

    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="本月累计支出与预测曲线">' +
      '<defs><linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#4C6FFF" stop-opacity=".15"/>' +
        '<stop offset="1" stop-color="#4C6FFF" stop-opacity="0"/>' +
      '</linearGradient></defs>' +
      '<line x1="' + padL + '" y1="' + (padT + ih) + '" x2="' + (W - padR) + '" y2="' + (padT + ih) + '" stroke="#EDF0F4" stroke-width="1"/>' +
      (s.limit > 0 ? '<path d="' + path(ideal) + '" fill="none" stroke="#DCE2EC" stroke-width="1.2" stroke-dasharray="3 4"/>' : '') +
      limitLine +
      area +
      '<path d="' + path(actual) + '" fill="none" stroke="#4C6FFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="' + path(proj) + '" fill="none" stroke="#4C6FFF" stroke-width="1.8" stroke-dasharray="4 3" opacity=".45" stroke-linecap="round"/>' +
      dot +
      '<text x="' + padL + '" y="' + (H - 1) + '" font-size="9.5" fill="#AEB5C1">1日</text>' +
      '<text x="' + (W - padR) + '" y="' + (H - 1) + '" font-size="9.5" fill="#AEB5C1" text-anchor="end">' + D + '日</text>' +
    '</svg>';
  }

  function txnRow(t, withDel) {
    var c = S.catOf(t.category);
    var title = t.note || c.name;
    var sub = t.note ? c.name : '';
    return '<div class="txn">' +
      '<div class="txn-ico">' + c.icon + '</div>' +
      '<div class="txn-main">' +
        '<div class="txn-name">' + esc(title) + '</div>' +
        (sub ? '<div class="txn-note">' + esc(sub) + '</div>' : '') +
      '</div>' +
      '<div class="txn-amt">' + money(t.amount) + '</div>' +
      (withDel ? '<button class="txn-del" type="button" data-action="del-txn" data-id="' + esc(t.id) + '" aria-label="删除">' +
        '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
      '</button>' : '') +
    '</div>';
  }

  function viewOverview() {
    var s = F.summarize({ txns: state.txns, limit: state.limit, windowDays: state.windowDays });
    var has = s.hasLimit;

    var chip;
    if (!has) chip = '<span class="status-chip is-none">未设限额</span>';
    else if (!s.hasData) chip = '<span class="status-chip is-none">待记录</span>';
    else if (s.perDay < 0) chip = '<span class="status-chip is-over">已超支 ¥' + money(Math.abs(s.remaining)) + '</span>';
    else if (s.status === 'over') chip = '<span class="status-chip is-over">预计超支 ¥' + money(s.forecastGap) + '</span>';
    else if (s.status === 'tight') chip = '<span class="status-chip is-tight">预计刚好用完</span>';
    else chip = '<span class="status-chip is-safe">预计结余 ¥' + money(-s.forecastGap) + '</span>';

    var label, val, sub;
    if (!has) {
      label = '本月已花';
      val = s.spent;
      sub = '填一个月限额，就能算出每天能花多少';
    } else if (s.perDay < 0) {
      label = '已经超出';
      val = Math.abs(s.remaining);
      sub = '本月还剩 ' + s.daysLeft + ' 天 · 建议从今天起收紧，或调高限额';
    } else {
      label = '今日建议支出';
      val = s.perDay;
      sub = '今日已花 ¥' + money(s.todaySpent) + ' · 本月还剩 ' + s.daysLeft + ' 天';
    }

    var hp = heroParts(val);
    var meter = '';
    if (has) {
      meter =
        '<div class="hero-meter' + (s.progress >= 1 ? ' is-over' : '') + '"><i style="width:' + (s.progress * 100).toFixed(1) + '%"></i></div>' +
        '<div class="hero-legend"><span>已花 ¥' + money(s.spent) + '</span><span>限额 ¥' + money(s.limit) + '</span></div>';
    }

    var cta = has ? '' : '<button class="hero-cta" type="button" data-action="go-settings">设置月限额 →</button>';

    var emptyHint = (has && !s.hasData)
      ? '<div class="hero-empty">今天先记一笔，预测和每日建议就会自动跟上。</div>' : '';

    var hero =
      '<section class="hero">' +
        '<div class="hero-top"><span class="hero-label">' + label + '</span>' + chip + '</div>' +
        '<div class="hero-amount"><span class="hero-cur">¥</span><span class="hero-val">' + hp.int + '</span>' +
          (hp.cents ? '<span class="hero-cents">.' + hp.cents + '</span>' : '') + '</div>' +
        '<div class="hero-sub">' + esc(sub) + '</div>' +
        cta + meter + emptyHint +
      '</section>';

    var forecastVal =
      '<div class="forecast-value"><span class="c">¥</span><span class="v">' + money(s.forecast) + '</span><span class="u">月底</span></div>' +
      '<div class="forecast-range">波动区间 ¥' + money(s.forecastLow) + ' – ¥' + money(s.forecastHigh) + '</div>';

    var verdict;
    if (!has) {
      verdict = '<div class="forecast-verdict is-tight">设置月限额后，这里会告诉你会不会超支</div>';
    } else if (s.status === 'over') {
      verdict = '<div class="forecast-verdict is-over">按当前速度，月底会比限额多花 ¥' + money(s.forecastGap) + '</div>';
    } else if (s.status === 'tight') {
      verdict = '<div class="forecast-verdict is-tight">按当前速度，月底差不多刚好用完</div>';
    } else {
      verdict = '<div class="forecast-verdict is-safe">按当前速度，月底还能剩 ¥' + money(-s.forecastGap) + '</div>';
    }

    var chart = s.hasData
      ? '<div class="chart">' + chartSVG(s) + '</div>' +
        '<div class="chart-legend"><span><i class="lg lg-solid"></i>已花</span>' +
        '<span><i class="lg lg-dash"></i>预测</span>' +
        (has ? '<span><i class="lg lg-dot"></i>限额</span>' : '') + '</div>'
      : '';

    var forecastCard = !s.hasData ? '' :
      '<section class="card" style="margin-top:14px">' +
        '<div class="forecast-head"><span class="forecast-title">本月预测</span>' +
        '<span class="forecast-note">近 ' + s.observedDays + ' 天日均 ¥' + money(s.dailyMean) + '</span></div>' +
        forecastVal + verdict + chart +
      '</section>';

    var recent = state.txns.filter(function (t) { return t.date.slice(0, 7) === s.monthKey; })
      .sort(function (a, b) { return a.date === b.date ? (b.ts - a.ts) : (a.date < b.date ? 1 : -1); })
      .slice(0, 6);

    var recentHtml = recent.length
      ? '<div class="section-title" style="margin-top:20px"><span>最近记录</span>' +
          '<button class="link" type="button" data-action="go-list">全部 ›</button></div>' +
        '<section class="card" style="padding:2px 16px 4px">' +
          recent.map(function (t) { return txnRow(t, false); }).join('') +
        '</section>'
      : '';

    var onboardHtml = s.hasData ? '' :
      '<section class="card" style="margin-top:14px;padding:18px 20px 16px">' +
        '<div class="onboard">' +
          '<div class="onboard-title">三步用起来</div>' +
          '<ol>' +
            '<li>在「设置」里填这个月打算花多少</li>' +
            '<li>每花一笔，点中间的 <b>+</b> 记下来</li>' +
            '<li>概览会算出今天还能花多少、月底大概花多少</li>' +
          '</ol>' +
        '</div>' +
      '</section>';

    return hero + forecastCard + onboardHtml + recentHtml;
  }

  /* ---------------- 视图：明细 ---------------- */

  function viewList() {
    var now = new Date();
    var ym = F.shiftMonth(now.getFullYear(), now.getMonth() + 1, -listOffset);
    var key = F.monthKeyOf(ym.year, ym.month);
    var txns = state.txns.filter(function (t) { return t.date.slice(0, 7) === key; });
    var total = F.monthTotal(state.txns, key);
    var groups = F.groupByDay(txns);
    var isCurrent = listOffset === 0;

    var nav =
      '<div class="month-nav">' +
        '<button class="mn-btn" type="button" data-action="prev-month" aria-label="上个月">' +
          '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M14.5 5.5 8 12l6.5 6.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</button>' +
        '<div><div class="mn-label">' + ym.year + '年' + ym.month + '月</div>' +
          '<div class="mn-sum">' + groups.length + ' 天 · 合计 ¥' + money(total) + '</div></div>' +
        '<button class="mn-btn" type="button" data-action="next-month"' + (isCurrent ? ' disabled' : '') + ' aria-label="下个月">' +
          '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M9.5 5.5 16 12l-6.5 6.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</button>' +
      '</div>';

    if (!groups.length) {
      return nav +
        '<section class="card"><div class="empty"><b>这个月还没有记录</b>点右下角的 + 记第一笔</div></section>';
    }

    var body = groups.map(function (g) {
      var daySum = '<span>' + dayLabel(g.date) + '</span><span>¥' + money(g.total) + '</span>';
      return '<div class="day-group"><div class="day-head">' + daySum + '</div>' +
        '<div class="card" style="padding:2px 16px 4px">' +
        g.items.map(function (t) { return txnRow(t, true); }).join('') +
        '</div></div>';
    }).join('');

    return nav + body;
  }

  /* ---------------- 视图：设置 ---------------- */

  function viewSettings() {
    var w = state.windowDays;

    var seg =
      '<div class="seg">' +
        '<button type="button" class="' + (Number(w) === 7 ? 'is-on' : '') + '" data-window="7">7天</button>' +
        '<button type="button" class="' + (Number(w) === 14 ? 'is-on' : '') + '" data-window="14">14天</button>' +
        '<button type="button" class="' + (w === 'month' ? 'is-on' : '') + '" data-window="month">整月</button>' +
      '</div>';

    return '<section class="card setting-block" style="margin-top:6px">' +
        '<div class="field">' +
          '<div><div class="field-label">月限额</div><div class="field-hint">每个月打算花多少</div></div>' +
          '<div class="field-side"><span class="money-field">' +
            '<span class="money-cur">¥</span>' +
            '<input class="money-input" id="limitInput" type="text" inputmode="decimal" autocomplete="off" value="' + state.limit + '"></span></div>' +
        '</div>' +
        '<div class="field">' +
          '<div><div class="field-label">预测依据</div><div class="field-hint">取最近多少天的日均</div></div>' +
          '<div class="field-side">' + seg + '</div>' +
        '</div>' +
      '</section>' +

      '<div class="section-title" style="margin-top:22px">数据</div>' +
      '<section class="card" style="padding:2px 16px 4px">' +
        '<button class="action-row" type="button" data-action="export">' +
          '<span class="ar-label">导出备份<span class="ar-sub">存成 JSON 文件，可再次导入</span></span>' +
          '<span class="ar-go">›</span></button>' +
        '<button class="action-row" type="button" data-action="copy">' +
          '<span class="ar-label">复制全部数据<span class="ar-sub">粘贴到备忘录里也是一份备份</span></span>' +
          '<span class="ar-go">›</span></button>' +
        '<button class="action-row" type="button" data-action="import">' +
          '<span class="ar-label">导入备份<span class="ar-sub">从 JSON 文件合并记录</span></span>' +
          '<span class="ar-go">›</span></button>' +
        '<button class="action-row is-danger" type="button" data-action="reset">' +
          '<span class="ar-label">清空所有数据</span><span class="ar-go">›</span></button>' +
      '</section>' +

      '<div class="section-title" style="margin-top:22px">说明</div>' +
      '<section class="card">' +
        '<div class="note-text">' +
          '<p style="margin:0 0 10px"><strong>数据只存在这台手机上。</strong>没有账号、没有服务器，也就没人能读到你的账。' +
          '代价是清除网站数据或卸载后会一起消失，所以隔段时间点一次「导出备份」。</p>' +
          '<p style="margin:0 0 10px"><strong>预测怎么算的。</strong>取最近 N 天（默认 14 天）的日均花销，对剩余天数做外推；' +
          '数据少时会往「限额日均」靠一点，避免月初一笔大额把预测带飞。</p>' +
          '<p style="margin:0"><strong>每日建议怎么算的。</strong>（月限额 − 已花）÷ 剩余天数（含今天）。</p>' +
          '<p style="margin:12px 0 0;color:#B4BAC5;font-size:12px">月衡 v1.0 · 离线可用</p>' +
        '</div>' +
      '</section>';
  }

  /* ---------------- 渲染 ---------------- */

  function syncTabs() {
    var tabs = document.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('is-active', tabs[i].getAttribute('data-view') === view);
    }
  }

  function render() {
    var s = F.summarize({ txns: state.txns, limit: state.limit, windowDays: state.windowDays });
    el.topMonth.textContent = s.monthLabel;

    var html;
    if (view === 'overview') html = viewOverview();
    else if (view === 'list') html = viewList();
    else html = viewSettings();

    var banner = DEMO
      ? '<div class="demo-banner">演示数据 · 改动不会保存 · <a href="./" style="color:inherit">去正式使用</a></div>'
      : '';

    el.view.innerHTML = banner + html;
    syncTabs();
    bindView();
  }

  function bindView() {
    var li = document.getElementById('limitInput');
    if (li) {
      li.addEventListener('change', function () {
        var v = Number(String(li.value).replace(/[^\d.]/g, ''));
        state.limit = isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : 0;
        persist();
        render();
        toast('月限额已更新');
      });
      li.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') li.blur();
      });
    }
  }

  function setView(next) {
    if (view === next) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    view = next;
    if (view !== 'list') listOffset = 0;
    render();
    window.scrollTo(0, 0);
  }

  /* ---------------- 事件 ---------------- */

  document.addEventListener('click', function (e) {
    var tab = e.target.closest('.tab[data-view]');
    if (tab) { setView(tab.getAttribute('data-view')); return; }

    var act = e.target.closest('[data-action]');
    if (act) {
      handleAction(act.getAttribute('data-action'), act, e);
      return;
    }

    var key = e.target.closest('[data-key]');
    if (key) { pressKey(key.getAttribute('data-key')); return; }

    var cat = e.target.closest('[data-cat]');
    if (cat) { entry.category = cat.getAttribute('data-cat'); renderCats(); return; }

    var dch = e.target.closest('[data-date]');
    if (dch) {
      var which = dch.getAttribute('data-date');
      setEntryDate(which === 'yesterday' ? F.keyOf(new Date(Date.now() - 86400000)) : F.keyOf(new Date()));
      return;
    }

    var win = e.target.closest('[data-window]');
    if (win) {
      var wv = win.getAttribute('data-window');
      state.windowDays = wv === 'month' ? 'month' : Number(wv);
      persist();
      render();
    }
  });

  function handleAction(name, node, e) {
    switch (name) {
      case 'open-sheet': openSheet(); break;
      case 'close-sheet': closeSheet(); break;
      case 'save-txn': saveTxn(); break;
      case 'del-txn': deleteTxn(node.getAttribute('data-id')); break;
      case 'prev-month': listOffset += 1; render(); break;
      case 'next-month': if (listOffset > 0) { listOffset -= 1; render(); } break;
      case 'go-list': setView('list'); break;
      case 'go-settings': setView('settings'); break;
      case 'export': doExport(); break;
      case 'copy': doCopy(); break;
      case 'import': doImport(); break;
      case 'reset': doReset(); break;
      case 'modal-ok': var cb = modalCb; closeModal(); if (cb) cb(); break;
      case 'modal-cancel': closeModal(); break;
      default: break;
    }
  }

  el.dateInput.addEventListener('change', function () {
    if (el.dateInput.value) setEntryDate(el.dateInput.value);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (el.modalRoot.classList.contains('is-open')) closeModal();
      else if (el.sheetRoot.classList.contains('is-open')) closeSheet();
    }
  });

  /* ---------------- 数据操作 ---------------- */

  function doExport() {
    var json = S.exportJSON(state);
    try {
      var blob = new Blob([json], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'yueheng-' + F.keyOf(new Date()) + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      toast('已导出备份');
    } catch (err) {
      toast('导出失败，请用「复制全部数据」');
    }
  }

  function doCopy() {
    var json = S.exportJSON(state);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(json).then(function () {
        toast('已复制，可粘贴到备忘录');
      }).catch(function () {
        fallbackCopy(json);
      });
    } else {
      fallbackCopy(json);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast('已复制'); } catch (e) { toast('复制失败'); }
    ta.remove();
  }

  function doImport() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json,text/plain';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', function () {
      var f = input.files && input.files[0];
      if (!f) { input.remove(); return; }
      f.text().then(function (text) {
        try {
          var r = S.importJSON(state, text);
          persist();
          render();
          toast('导入 ' + r.added + ' 条记录');
        } catch (err) {
          toast(err && err.message ? err.message : '导入失败');
        }
        input.remove();
      });
    });
    input.click();
  }

  function doReset() {
    showModal({
      title: '清空所有数据？',
      body: '全部记录和限额设置都会被删掉，无法撤销。<br>建议先导出一份备份。',
      okText: '清空',
      danger: true,
      onOk: function () {
        state = S.defaults();
        persist();
        listOffset = 0;
        render();
        toast('已清空');
      }
    });
  }

  /* ---------------- 启动 ---------------- */

  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () { /* 离线缓存失败不影响使用 */ });
    });
  }

  // 便于截图/演示：?view=list|settings 直接打开对应页，?sheet=1 直接打开记账面板
  (function () {
    var qs = new URLSearchParams(location.search);
    var v = qs.get('view');
    if (v === 'list' || v === 'settings') view = v;
  })();

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) render();
  });

  render();

  if (/[?&]sheet=1(?:&|$)/.test(location.search)) openSheet();
})();
