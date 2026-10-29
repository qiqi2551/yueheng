/* 月衡 · 计算核心
 * 纯函数，不依赖 DOM，可单独用 Node 测试。
 */
(function (global) {
  'use strict';

  /** 月初数据太少时，用「限额日均」当先验，避免一笔大额把预测带飞 */
  function priorWeightFor(observedSpan) {
    if (observedSpan <= 3) return 2;
    if (observedSpan <= 7) return 1;
    return 0;
  }
  /** 预测区间的上下浮动，按日均标准差的这个倍数展开 */
  var SPREAD_FACTOR = 0.5;

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function keyOf(date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }

  function parseKey(k) {
    var p = String(k || '').split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  /** month1 从 1 开始 */
  function daysInMonth(year, month1) {
    return new Date(year, month1, 0).getDate();
  }

  function round2(n) {
    if (!isFinite(n)) return 0;
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }

  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }

  /**
   * 汇总某个月的花销并给出预测。
   * @param {{txns:Array, limit:number, windowDays:(number|'month'), now:(Date|string|number)}} input
   */
  function summarize(input) {
    input = input || {};
    var now = input.now ? new Date(input.now) : new Date();
    var year = now.getFullYear();
    var month = now.getMonth() + 1;
    var D = daysInMonth(year, month);
    var today = clamp(now.getDate(), 1, D);
    var limit = Math.max(0, num(input.limit));
    var txns = Array.isArray(input.txns) ? input.txns : [];
    var monthKey = year + '-' + pad2(month);

    // 逐日累加，只取本月
    var daily = new Array(D + 1);
    for (var i = 0; i <= D; i++) daily[i] = 0;

    var spent = 0;
    var todaySpent = 0;
    var monthTxns = [];
    var todayStr = keyOf(now);

    for (var j = 0; j < txns.length; j++) {
      var t = txns[j];
      if (!t || typeof t.date !== 'string') continue;
      if (t.date.slice(0, 7) !== monthKey) continue;
      var day = Number(t.date.slice(8, 10));
      var amt = num(t.amount);
      if (!(day >= 1 && day <= D)) continue;
      monthTxns.push(t);
      daily[day] += amt;
      spent += amt;
      if (t.date === todayStr) todaySpent += amt;
    }
    spent = round2(spent);
    todaySpent = round2(todaySpent);

    // 没有限额时，用已花金额推一个基准，仅用于图表与预测，不影响建议值
    var baseline = limit > 0 ? limit / D : (today > 0 ? spent / today : 0);

    // 从第一笔记录算起才是「观测期」：前面的空白不代表那几天没花钱
    var firstDay = today;
    for (var q = 0; q < monthTxns.length; q++) {
      var qd = Number(monthTxns[q].date.slice(8, 10));
      if (qd < firstDay) firstDay = qd;
    }
    var observedSpan = today - firstDay + 1;
    var hasData = monthTxns.length > 0;

    // 观测窗口：默认「最近 N 天」，但不能超过本月已观测的天数
    var windowDays = input.windowDays;
    if (!windowDays || windowDays === 'month') windowDays = observedSpan;
    windowDays = Math.max(1, Math.min(Math.round(num(windowDays)) || observedSpan, observedSpan));

    var sumW = 0;
    for (var k = 0; k < windowDays; k++) sumW += daily[today - k];

    // 收缩估计：月初信先验，数据攒够之后就完全按最近的实测走
    var priorWeight = priorWeightFor(observedSpan);
    var mu = priorWeight > 0
      ? (sumW + baseline * priorWeight) / (windowDays + priorWeight)
      : sumW / windowDays;

    // 日花销波动
    var obsMean = sumW / windowDays;
    var variance = 0;
    for (var m = 0; m < windowDays; m++) {
      var d = daily[today - m] - obsMean;
      variance += d * d;
    }
    variance = windowDays > 1 ? variance / (windowDays - 1) : 0;
    var sd = Math.sqrt(variance);

    var afterToday = D - today;
    var forecast = round2(spent + mu * afterToday);
    var forecastLow = round2(spent + Math.max(0, mu - SPREAD_FACTOR * sd) * afterToday);
    var forecastHigh = round2(spent + (mu + SPREAD_FACTOR * sd) * afterToday);

    // 今日建议：剩余额度平分到「今天起剩下的每一天」
    var daysLeft = D - today + 1;
    var remaining = round2(limit - spent);
    var perDay = limit > 0 ? round2(remaining / daysLeft) : null;
    var suggestedToday = perDay === null ? null : Math.max(0, perDay);
    var todayRemaining = perDay === null ? null : round2(perDay - todaySpent);

    // 节奏对比：到今天为止「计划应该花掉多少」
    var planSpent = round2(limit * (today - 1) / D);
    var paceGap = round2(spent - planSpent);

    var status = 'none';
    if (limit > 0) {
      if (forecast > limit * 1.001) status = 'over';
      else if (forecast > limit * 0.9) status = 'tight';
      else status = 'safe';
    }

    var progress = limit > 0 ? clamp(spent / limit, 0, 1) : 0;

    // 图表数据：1..D，今天之前是实际值，之后是预测值
    var series = [];
    var cum = 0;
    for (var day2 = 1; day2 <= D; day2++) {
      var point = { day: day2, ideal: round2(limit * day2 / D) };
      if (day2 <= today) {
        cum += daily[day2];
        point.actual = round2(cum);
        point.projected = day2 === today ? round2(cum) : null;
      } else {
        point.actual = null;
        point.projected = round2(spent + mu * (day2 - today));
      }
      series.push(point);
    }

    return {
      year: year,
      month: month,
      monthLabel: year + '年' + month + '月',
      monthKey: monthKey,
      daysInMonth: D,
      today: today,
      daysLeft: daysLeft,
      afterToday: afterToday,
      limit: limit,
      hasLimit: limit > 0,
      spent: spent,
      remaining: remaining,
      todaySpent: todaySpent,
      perDay: perDay,
      suggestedToday: suggestedToday,
      todayRemaining: todayRemaining,
      dailyMean: round2(mu),
      observedDays: windowDays,
      observedSpan: observedSpan,
      firstDay: firstDay,
      hasData: hasData,
      observedSd: round2(sd),
      forecast: forecast,
      forecastLow: forecastLow,
      forecastHigh: forecastHigh,
      forecastGap: round2(forecast - limit),
      planSpent: planSpent,
      paceGap: paceGap,
      status: status,
      progress: progress,
      series: series,
      daily: daily,
      monthTxns: monthTxns
    };
  }

  /** 把交易按天分组、按时间倒序，供明细页使用 */
  function groupByDay(txns) {
    var list = (txns || []).slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (b.ts || 0) - (a.ts || 0);
    });
    var groups = [];
    var map = {};
    for (var i = 0; i < list.length; i++) {
      var t = list[i];
      if (!map[t.date]) {
        map[t.date] = { date: t.date, total: 0, items: [] };
        groups.push(map[t.date]);
      }
      map[t.date].items.push(t);
      map[t.date].total = round2(map[t.date].total + num(t.amount));
    }
    return groups;
  }

  /** 某个月的总额，用于明细页月份切换 */
  function monthTotal(txns, monthKey) {
    var total = 0;
    for (var i = 0; i < (txns || []).length; i++) {
      var t = txns[i];
      if (t && typeof t.date === 'string' && t.date.slice(0, 7) === monthKey) total += num(t.amount);
    }
    return round2(total);
  }

  function monthKeyOf(year, month1) { return year + '-' + pad2(month1); }

  function shiftMonth(year, month1, delta) {
    var d = new Date(year, month1 - 1 + delta, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }

  var api = {
    summarize: summarize,
    groupByDay: groupByDay,
    monthTotal: monthTotal,
    monthKeyOf: monthKeyOf,
    shiftMonth: shiftMonth,
    daysInMonth: daysInMonth,
    keyOf: keyOf,
    parseKey: parseKey,
    round2: round2,
    pad2: pad2
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.Finance = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
