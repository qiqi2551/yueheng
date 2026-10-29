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

  function moneyParts(n) {
    var v = Math.abs(Math.round((Number(n) || 0) * 100) / 100);
    var parts = v.toFixed(2).split('.');
    return { int: group3(parts[0]), cents: parts[1] };
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
        '<span class="cat-dot" data-c="' + c.id + '">' + c.short + '</span><span>' + c.name + '</span></button>';
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
      body: esc(c.name + (t.note ? ' · ' + t.note : '')) + '<br>¥' + money(t.amount),
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

  /* ---------------- 通用小组件 ---------------- */

  function icon(catId, cls) {
    var c = S.catOf(catId);
    return '<span class="' + (cls || 'ico') + '" data-c="' + c.id + '">' + c.short + '</span>';
  }

  function txnRow(t, withDel) {
    var c = S.catOf(t.category);
    var title = t.note || c.name;
    var sub = t.note ? c.name : '';
    return '<div class="txn">' +
      icon(t.category) +
      '<div class="txn-main">' +
        '<div class="txn-name">' + esc(title) + '</div>' +
        (sub ? '<div class="txn-note">' + esc(sub) + '</div>' : '') +
      '</div>' +
      '<div class="txn-amt">' + money(t.amount) + '</div>' +
      (withDel ? '<button class="txn-del" type="button" data-action="del-txn" data-id="' + esc(t.id) + '" aria-label="删除">' +
        '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
      '</button>' : '') +
    '</div>';
  }

  /* ---------------- 图表 ---------------- */

  function chartSVG(s) {
    var W = 320, H = 132, padL = 4, padR = 4, padT = 10, padB = 18;
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
      if (p.actual != null && p.day >= s.firstDay) actual.push([X(p.day), Y(p.actual)]);
      if (p.projected != null) proj.push([X(p.day), Y(p.projected)]);
      ideal.push([X(p.day), Y(p.ideal)]);
    }

    var area = '';
    if (actual.length > 1) {
      area = '<path class="chart-area" d="' + path(actual) +
        'L' + actual[actual.length - 1][0].toFixed(1) + ' ' + (padT + ih) +
        'L' + actual[0][0].toFixed(1) + ' ' + (padT + ih) + 'Z"/>';
    }

    var limitLine = '';
    if (s.limit > 0 && s.limit <= maxV) {
      var yl = Y(s.limit).toFixed(1);
      limitLine = '<line class="chart-limit" x1="' + padL + '" y1="' + yl + '" x2="' + (W - padR) + '" y2="' + yl + '"/>';
    }

    var dot = '';
    if (s.hasData) {
      dot = '<circle class="chart-dot" cx="' + X(s.today).toFixed(1) + '" cy="' + Y(s.spent).toFixed(1) + '" r="3.5"/>';
    }

    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="本月累计支出与预测曲线">' +
      '<line class="chart-axis-line" x1="' + padL + '" y1="' + (padT + ih) + '" x2="' + (W - padR) + '" y2="' + (padT + ih) + '"/>' +
      (s.limit > 0 ? '<path class="chart-ideal" d="' + path(ideal) + '"/>' : '') +
      limitLine + area +
      '<path class="chart-line" d="' + path(actual) + '"/>' +
      '<path class="chart-proj" d="' + path(proj) + '"/>' +
      dot +
      '<text class="chart-tick" x="' + padL + '" y="' + (H - 2) + '">1日</text>' +
      '<text class="chart-tick" x="' + (W - padR) + '" y="' + (H - 2) + '" text-anchor="end">' + D + '日</text>' +
    '</svg>';
  }

  /* ---------------- 视图：概览 ---------------- */

  function viewOverview() {
    var s = F.summarize({
      txns: state.txns, limit: state.limit, windowDays: state.windowDays,
      carryOver: state.carryOver !== false
    });
    var has = s.hasLimit;

    // ---------- 今日额度 ----------
    var label, value, tag, tagCls, meta, notice = '';

    if (!has) {
      label = '本月已花';
      value = s.spent;
      tag = '未设限额'; tagCls = 'is-mute';
      meta = '填一个月限额，就能算出每天能花多少';
    } else {
      var over = s.todayLeft < 0;
      label = over ? '今天已超出' : '今天还能花';
      value = Math.abs(s.todayLeft);
      tag = over ? '超支' : (s.todayLeft === 0 ? '刚好用完' : '预算内');
      tagCls = over ? 'is-bad' : (s.todayLeft === 0 ? 'is-warn' : 'is-ok');
      meta = '今日额度 ¥' + money(s.allowanceToday) + ' · 已花 ¥' + money(s.todaySpent);

      if (s.afterToday === 0) {
        notice = over
          ? '今天是本月最后一天，已超出 ¥' + money(-s.todayLeft)
          : '今天是本月最后一天，还剩 ¥' + money(s.todayLeft) + ' 没用完';
      } else if (s.allowanceDelta > 0.004) {
        notice = '今天比额度少花 ¥' + money(s.todayLeft) + '，明天额度上调到 ¥' + money(s.allowanceTomorrow);
      } else if (s.allowanceDelta < -0.004) {
        notice = '今天超出额度 ¥' + money(-s.todayLeft) + '，明天额度下调到 ¥' + money(s.allowanceTomorrow);
      } else {
        notice = '今天正好花完额度，明天额度保持 ¥' + money(s.allowanceTomorrow);
      }
    }

    var hp = moneyParts(value);
    var grid = has
      ? '<div class="pgrid">' +
          '<div class="pg"><span>平均每日</span><b>¥' + money(s.basePerDay) + '</b></div>' +
          '<div class="pg"><span>今日额度</span><b>¥' + money(s.allowanceToday) + '</b></div>' +
          '<div class="pg"><span>明日额度</span><b>' + (s.allowanceTomorrow === null ? '—' : '¥' + money(s.allowanceTomorrow)) + '</b></div>' +
        '</div>'
      : '<div class="pgrid"><div class="pg"><span>记录</span><b>' + s.monthTxns.length + ' 笔</b></div>' +
        '<div class="pg"><span>剩余天数</span><b>' + s.daysLeft + ' 天</b></div></div>';

    var cta = has ? '' : '<button class="primary-cta" type="button" data-action="go-settings">设置月限额</button>';

    var primary =
      '<section class="primary">' +
        '<div class="primary-top"><span class="plabel">' + label + '</span><span class="tag ' + tagCls + '">' + tag + '</span></div>' +
        '<div class="pvalue"><span class="pcur">¥</span><span class="pint">' + hp.int + '</span><span class="pdec">.' + hp.cents + '</span></div>' +
        '<div class="pmeta">' + esc(meta) + '</div>' +
        cta + grid +
      '</section>';

    var noticeHtml = notice
      ? '<div class="notice ' + (s.todayLeft < 0 ? 'is-bad' : (s.todayLeft === 0 ? 'is-mute' : 'is-ok')) + '">' + esc(notice) + '</div>'
      : '';

    // ---------- 本月预算 ----------
    var carryNote = (has && s.carryIn < 0)
      ? '<div class="carry-note">上月超支结转 −¥' + money(-s.carryIn) + '　限额 ¥' + money(s.limit) + ' → 可用 ¥' + money(s.budget) + '</div>'
      : '';

    var budgetCard = has ? (
      '<section class="card">' +
        '<div class="chead"><span>本月预算</span><span class="mu">剩 ' + s.daysLeft + ' 天 · 已用 ' + Math.round(s.progress * 100) + '%</span></div>' +
        '<div class="bar"><i class="' + (s.progress >= 1 ? 'is-over' : '') + '" style="width:' + (s.progress * 100).toFixed(1) + '%"></i></div>' +
        '<div class="bar-legend"><span>已花 ¥' + money(s.spent) + '</span><span>可用 ¥' + money(s.budget) + '</span></div>' +
        carryNote +
        '<div class="kpis">' +
          '<div class="kpi"><span>剩余额度</span><b class="' + (s.remaining < 0 ? 'is-bad' : '') + '">¥' + money(s.remaining) + '</b></div>' +
          '<div class="kpi"><span>' + (s.hasData ? '近 ' + s.observedDays + ' 天日均' : '日均') + '</span><b>' + (s.hasData ? '¥' + money(s.dailyMean) : '—') + '</b></div>' +
          '<div class="kpi"><span>月底预测</span><b class="' + (s.status === 'over' ? 'is-bad' : (s.status === 'tight' ? 'is-warn' : '')) + '">' + (s.hasData ? '¥' + money(s.forecast) : '—') + '</b></div>' +
        '</div>' +
      '</section>'
    ) : '';

    var forecastCard = (has && s.hasData) ? (
      '<section class="card">' +
        '<div class="chead"><span>累计与预测</span>' +
          '<span class="mu">' + (s.status === 'over' ? '预计超支 ¥' + money(s.forecastGap)
            : s.status === 'tight' ? '预计刚好用完'
            : '预计结余 ¥' + money(-s.forecastGap)) + '</span></div>' +
        '<div class="chart">' + chartSVG(s) + '</div>' +
        '<div class="legend">' +
          '<span><i class="lg lg-line"></i>已花</span>' +
          '<span><i class="lg lg-dash"></i>预测</span>' +
          '<span><i class="lg lg-dot"></i>限额</span>' +
          '<span style="margin-left:auto">区间 ¥' + money(s.forecastLow) + ' – ¥' + money(s.forecastHigh) + '</span>' +
        '</div>' +
      '</section>'
    ) : '';

    // ---------- 分类 ----------
    var cats = s.categories.slice(0, 4);
    var catCard = cats.length ? (
      '<section class="card">' +
        '<div class="chead"><span>分类</span><span class="mu">本月</span></div>' +
        cats.map(function (c) {
          var meta2 = S.catOf(c.id);
          return '<div class="cat-row">' +
            '<span class="cat-row-name">' + esc(meta2.name) + '</span>' +
            '<div class="cat-track"><i data-c="' + c.id + '" style="width:' + Math.max(2, c.share * 100).toFixed(1) + '%"></i></div>' +
            '<span class="cat-row-amt">' + Math.round(c.share * 100) + '%</span>' +
            '<span class="cat-row-val">¥' + money(c.amount) + '</span>' +
          '</div>';
        }).join('') +
      '</section>'
    ) : '';

    // ---------- 最近记录 ----------
    var recent = state.txns.filter(function (t) { return t.date.slice(0, 7) === s.monthKey; })
      .sort(function (a, b) { return a.date === b.date ? (b.ts - a.ts) : (a.date < b.date ? 1 : -1); })
      .slice(0, 6);

    var recentCard = recent.length
      ? '<div class="shead"><span>最近记录</span><button class="link" type="button" data-action="go-list">全部</button></div>' +
        '<section class="card card--list">' + recent.map(function (t) { return txnRow(t, false); }).join('') + '</section>'
      : '';

    // ---------- 首次引导 ----------
    var onboard = s.hasData ? '' :
      '<section class="card">' +
        '<div class="chead"><span>三步用起来</span></div>' +
        '<ol class="steps">' +
          '<li>在「设置」里填这个月打算花多少</li>' +
          '<li>每花一笔，点中间的 <b>+</b> 记下来</li>' +
          '<li>首页会算出今天还能花多少、月底大概花多少</li>' +
        '</ol>' +
      '</section>';

    return primary + noticeHtml + budgetCard + onboard + forecastCard + catCard + recentCard;
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
        '<div class="mn-mid"><div class="mn-label">' + ym.year + '年' + ym.month + '月</div>' +
          '<div class="mn-sum">' + groups.length + ' 天 · 合计 ¥' + money(total) + '</div></div>' +
        '<button class="mn-btn" type="button" data-action="next-month"' + (isCurrent ? ' disabled' : '') + ' aria-label="下个月">' +
          '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M9.5 5.5 16 12l-6.5 6.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</button>' +
      '</div>';

    if (!groups.length) {
      return nav + '<section class="card"><div class="empty">这个月还没有记录<br>点底部中间的 + 记一笔</div></section>';
    }

    var body = groups.map(function (g) {
      return '<div class="day-group">' +
        '<div class="day-head"><span>' + dayLabel(g.date) + '</span><span>¥' + money(g.total) + '</span></div>' +
        '<section class="card card--list">' + g.items.map(function (t) { return txnRow(t, true); }).join('') + '</section>' +
      '</div>';
    }).join('');

    return nav + body;
  }

  /* ---------------- 视图：设置 ---------------- */

  function viewSettings() {
    var w = state.windowDays;

    var seg =
      '<div class="seg">' +
        '<button type="button" class="' + (Number(w) === 7 ? 'is-on' : '') + '" data-window="7">7 天</button>' +
        '<button type="button" class="' + (Number(w) === 14 ? 'is-on' : '') + '" data-window="14">14 天</button>' +
        '<button type="button" class="' + (w === 'month' ? 'is-on' : '') + '" data-window="month">整月</button>' +
      '</div>';

    return '<section class="card setting-block">' +
        '<div class="field">' +
          '<div><div class="field-label">月限额</div><div class="field-hint">每个月打算花多少</div></div>' +
          '<div class="field-side"><span class="money-field">' +
            '<span class="money-cur">¥</span>' +
            '<input class="money-input" id="limitInput" type="text" inputmode="decimal" autocomplete="off" value="' + state.limit + '"></span></div>' +
        '</div>' +
        '<div class="field">' +
          '<div><div class="field-label">预测窗口</div><div class="field-hint">按最近多少天的日均推算</div></div>' +
          '<div class="field-side">' + seg + '</div>' +
        '</div>' +
        '<div class="field">' +
          '<div><div class="field-label">超支结转</div><div class="field-hint">上月还欠着的钱，扣到本月</div></div>' +
          '<div class="field-side"><button class="switch' + (state.carryOver !== false ? ' is-on' : '') +
            '" type="button" data-action="toggle-carry" role="switch" aria-checked="' + (state.carryOver !== false) + '"><i></i></button></div>' +
        '</div>' +
      '</section>' +

      '<div class="shead"><span>数据</span></div>' +
      '<section class="card card--list">' +
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

      '<div class="shead"><span>口径与说明</span></div>' +
      '<section class="card">' +
        '<div class="note-text">' +
          '<p><b>平均每日</b>：月限额 ÷ 当月天数。只是一个平摊参考，不是你要花的数。</p>' +
          '<p><b>今日额度</b>：(月限额 − 今天之前的支出) ÷ 剩余天数。它在你花今天第一笔钱之前就定下了，不会因为今天花多了而缩水。</p>' +
          '<p><b>今天还能花</b>：今日额度 − 今天已花。负数就是超支。</p>' +
          '<p><b>明日额度</b>：(月限额 − 累计已花) ÷ 今天之后的天数。今天省下的钱会摊到后面几天，额度上调；今天超支则会挤占后面的额度，下调。</p>' +
          '<p><b>日均</b>：取最近 N 天（默认 14 天）的平均支出。记录不足几天时会向「平均每日」靠一点，避免一笔大额把预测带飞。</p>' +
          '<p><b>月底预测</b>：已花 + 日均 × 剩余天数，用来判断按现在的速度会不会超支。</p>' +
          '<p><b>超支结转</b>：月底还欠着的部分会扣到下个月的可用额度里（只结转欠款，结余不累积）。历史月份按当前设置的限额估算。</p>' +
          '<p class="dim">数据只存在这台手机上，没有账号也没有服务器。清除网站数据或卸载会一起消失，建议每月导出一次备份。</p>' +
          '<p class="dim">月衡 v1.1</p>' +
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
    var s = F.summarize({
      txns: state.txns, limit: state.limit, windowDays: state.windowDays,
      carryOver: state.carryOver !== false
    });
    el.topMonth.textContent = s.monthLabel;

    var html;
    if (view === 'overview') html = viewOverview();
    else if (view === 'list') html = viewList();
    else html = viewSettings();

    var banner = DEMO
      ? '<div class="demo-banner">演示数据 · 改动不会保存 · <a href="./">去正式使用</a></div>'
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

  function handleAction(name, node) {
    switch (name) {
      case 'open-sheet': openSheet(); break;
      case 'close-sheet': closeSheet(); break;
      case 'save-txn': saveTxn(); break;
      case 'del-txn': deleteTxn(node.getAttribute('data-id')); break;
      case 'prev-month': listOffset += 1; render(); break;
      case 'next-month': if (listOffset > 0) { listOffset -= 1; render(); } break;
      case 'go-list': setView('list'); break;
      case 'go-settings': setView('settings'); break;
      case 'toggle-carry':
        state.carryOver = (state.carryOver === false);
        persist();
        render();
        toast(state.carryOver ? '已开启超支结转' : '已关闭超支结转');
        break;
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
