/* 计算逻辑测试：node tools/test-finance.cjs */
const assert = require('node:assert');
const F = require('../js/finance.js');

let passed = 0;
function ok(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { console.log('  ✗ ' + name + '\n    ' + e.message); process.exitCode = 1; }
}
function near(a, b, tol = 0.05) {
  assert.ok(Math.abs(a - b) <= tol, `期望 ${b}，实际 ${a}`);
}

function tx(date, amount, category = 'food', note = '') {
  return { id: date + amount + Math.random(), amount, category, note, date, ts: Date.parse(date) };
}

console.log('\n[1] 15 号，每天 100，限额 3000');
{
  const txns = [];
  for (let d = 1; d <= 15; d++) txns.push(tx(`2026-10-${String(d).padStart(2, '0')}`, 100));
  const s = F.summarize({ txns, limit: 3000, windowDays: 14, now: new Date(2026, 9, 15) });

  ok('日历正确', () => {
    assert.equal(s.daysInMonth, 31);
    assert.equal(s.today, 15);
    assert.equal(s.daysLeft, 17);
    assert.equal(s.afterToday, 16);
  });
  ok('已花 1500', () => near(s.spent, 1500));
  ok('今日已花 100', () => near(s.todaySpent, 100));
  ok('每日建议 (3000-1500)/17', () => near(s.perDay, 1500 / 17));
  ok('日均按 14 天窗口', () => near(s.dailyMean, 100, 0.01));
  ok('预测 = 已花 + 日均×剩余', () => near(s.forecast, 1500 + s.dailyMean * 16, 0.6));
  ok('预测超支', () => {
    assert.equal(s.status, 'over');
    near(s.forecastGap, s.forecast - 3000, 0.01);
  });
  ok('区间包住预测', () => {
    assert.ok(s.forecastLow <= s.forecast && s.forecast <= s.forecastHigh + 0.01);
  });
  ok('进度 50%', () => near(s.progress, 0.5, 0.001));
}

console.log('\n[2] 没有任何记录');
{
  const s = F.summarize({ txns: [], limit: 3000, windowDays: 14, now: new Date(2026, 9, 15) });
  ok('hasData=false', () => assert.equal(s.hasData, false));
  ok('无数据时建议值 = 3000/剩余17天', () => near(s.perDay, 3000 / 17, 0.01));
  ok('已花 0', () => assert.equal(s.spent, 0));
}

console.log('\n[3] 超支');
{
  const txns = [tx('2026-10-03', 2000), tx('2026-10-10', 1300)];
  const s = F.summarize({ txns, limit: 3000, windowDays: 14, now: new Date(2026, 9, 15) });
  ok('剩余为负', () => assert.ok(s.remaining < 0));
  ok('每日建议为负', () => assert.ok(s.perDay < 0));
  ok('状态超支', () => assert.equal(s.status, 'over'));
}

console.log('\n[4] 窗口不能超过已观测天数');
{
  const txns = [tx('2026-10-13', 50), tx('2026-10-14', 60), tx('2026-10-15', 70)];
  const s = F.summarize({ txns, limit: 3000, windowDays: 14, now: new Date(2026, 9, 15) });
  ok('观测天数被压到 3', () => assert.equal(s.observedSpan, 3));
  ok('实际窗口 = 3', () => assert.equal(s.observedDays, 3));
  ok('今天之前没有零值稀释', () => {
    assert.ok(s.dailyMean > 50 && s.dailyMean < 90);
  });
}

console.log('\n[5] 整月窗口');
{
  const txns = [tx('2026-10-01', 300), tx('2026-10-15', 100)];
  const s = F.summarize({ txns, limit: 3000, windowDays: 'month', now: new Date(2026, 9, 15) });
  ok('窗口 = 已过天数', () => assert.equal(s.observedDays, 15));
  ok('日均 = 400/15 →500 前提收缩', () => assert.ok(s.dailyMean > 20 && s.dailyMean < 27));
}

console.log('\n[6] 跨月、跨年');
{
  ok('10 月往前推一个月', () => {
    const r = F.shiftMonth(2026, 1, -1);
    assert.deepEqual(r, { year: 2025, month: 12 });
  });
  ok('12 月往后推一个月', () => {
    const r = F.shiftMonth(2026, 12, 1);
    assert.deepEqual(r, { year: 2027, month: 1 });
  });
  ok('2 月天数', () => {
    assert.equal(F.daysInMonth(2026, 2), 28);
    assert.equal(F.daysInMonth(2028, 2), 29);
  });
}

console.log('\n[7] 按天分组');
{
  const list = [tx('2026-10-02', 10), tx('2026-10-02', 20), tx('2026-10-01', 5)];
  const g = F.groupByDay(list);
  ok('两天两组', () => assert.equal(g.length, 2));
  ok('按日期倒序', () => assert.equal(g[0].date, '2026-10-02'));
  ok('组内合计 30', () => assert.equal(g[0].total, 30));
}

console.log('\n[8] 金额精度');
{
  const txns = [tx('2026-10-01', 0.1), tx('2026-10-01', 0.2)];
  const s = F.summarize({ txns, limit: 0, windowDays: 14, now: new Date(2026, 9, 1) });
  ok('0.1 + 0.2 = 0.3', () => assert.equal(s.spent, 0.3));
}

console.log('\n通过 ' + passed + ' 项\n');
