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

console.log('\n[1] 用户场景：限额 150，29 号这天花了 50');
{
  const s = F.summarize({
    txns: [tx('2026-10-29', 50)], limit: 150, windowDays: 14, now: new Date(2026, 9, 29)
  });
  ok('当月 31 天、剩 3 天', () => {
    assert.equal(s.daysInMonth, 31);
    assert.equal(s.daysLeft, 3);
    assert.equal(s.afterToday, 2);
  });
  ok('平均每日 = 150/31', () => near(s.basePerDay, 4.84, 0.01));
  ok('今日额度 = 150/3 = 50（不含今天的支出）', () => near(s.allowanceToday, 50, 0.01));
  ok('今天还能花 = 50-50 = 0', () => near(s.todayLeft, 0, 0.01));
  ok('明日额度 = (150-50)/2 = 50', () => near(s.allowanceTomorrow, 50, 0.01));
  ok('明天额度不变', () => near(s.allowanceDelta, 0, 0.01));
}

console.log('\n[2] 同一场景，今天花 60（超支 10）');
{
  const s = F.summarize({
    txns: [tx('2026-10-29', 60)], limit: 150, windowDays: 14, now: new Date(2026, 9, 29)
  });
  ok('今日额度仍是 50（不因今天花多而缩水）', () => near(s.allowanceToday, 50, 0.01));
  ok('今天超出 10', () => near(s.todayLeft, -10, 0.01));
  ok('明日额度下调到 45', () => near(s.allowanceTomorrow, 45, 0.01));
  ok('下调幅度 5', () => near(s.allowanceDelta, -5, 0.01));
}

console.log('\n[3] 同一场景，今天只花 30（省 20）');
{
  const s = F.summarize({
    txns: [tx('2026-10-29', 30)], limit: 150, windowDays: 14, now: new Date(2026, 9, 29)
  });
  ok('今天还剩 20', () => near(s.todayLeft, 20, 0.01));
  ok('明日额度上调到 60', () => near(s.allowanceTomorrow, 60, 0.01));
  ok('上调幅度 10', () => near(s.allowanceDelta, 10, 0.01));
}

console.log('\n[4] 前半月记录，验证口径');
{
  const txns = [];
  for (let d = 1; d <= 15; d++) txns.push(tx(`2026-10-${String(d).padStart(2, '0')}`, 100));
  const s = F.summarize({ txns, limit: 3000, windowDays: 14, now: new Date(2026, 9, 15) });

  ok('已花 1500，今日已花 100', () => { near(s.spent, 1500); near(s.todaySpent, 100); });
  ok('今天之前花了 1400', () => near(s.spentBeforeToday, 1400));
  ok('今日额度 = (3000-1400)/17', () => near(s.allowanceToday, 1600 / 17, 0.01));
  ok('今天还能花 = 额度 - 100', () => near(s.todayLeft, 1600 / 17 - 100, 0.02));
  ok('明日额度 = 1500/16', () => near(s.allowanceTomorrow, 1500 / 16, 0.01));
  ok('预测超支', () => assert.equal(s.status, 'over'));
  ok('区间包住预测', () => assert.ok(s.forecastLow <= s.forecast && s.forecast <= s.forecastHigh + 0.01));
}

console.log('\n[5] 超支结转');
{
  const txns = [
    tx('2026-09-10', 700), tx('2026-09-20', 500),   // 9 月花 1200，限额 1000 → 欠 200
    tx('2026-10-02', 100)
  ];
  const s = F.summarize({ txns, limit: 1000, windowDays: 14, now: new Date(2026, 9, 15) });
  ok('结转 -200', () => near(s.carryIn, -200, 0.01));
  ok('本月可用额度 800', () => near(s.budget, 800, 0.01));
  ok('限额本身不变', () => near(s.limit, 1000, 0.01));
  ok('剩余 = 800-100', () => near(s.remaining, 700, 0.01));

  const off = F.summarize({ txns, limit: 1000, windowDays: 14, now: new Date(2026, 9, 15), carryOver: false });
  ok('关掉结转后没有欠款', () => near(off.carryIn, 0));
}

console.log('\n[6] 连续两个月超支');
{
  const txns = [
    tx('2026-08-10', 1100),   // 8 月欠 100
    tx('2026-09-10', 1050),   // 9 月可用 900，花 1050 → 欠 150
    tx('2026-10-02', 50)
  ];
  const s = F.summarize({ txns, limit: 1000, windowDays: 14, now: new Date(2026, 9, 15) });
  ok('累计欠款 150', () => near(s.carryIn, -150, 0.01));
  ok('本月可用 850', () => near(s.budget, 850, 0.01));
}

console.log('\n[7] 结余不结转');
{
  const txns = [tx('2026-09-10', 300), tx('2026-10-02', 50)];
  const s = F.summarize({ txns, limit: 1000, windowDays: 14, now: new Date(2026, 9, 15) });
  ok('上月省下 700 不带入本月', () => {
    near(s.carryIn, 0);
    near(s.budget, 1000);
  });
}

console.log('\n[8] 上个月没有记录则不追溯');
{
  const txns = [tx('2026-08-10', 2000), tx('2026-10-02', 50)];
  const s = F.summarize({ txns, limit: 1000, windowDays: 14, now: new Date(2026, 9, 15) });
  ok('9 月空白，不产生欠款', () => near(s.carryIn, 0));
}

console.log('\n[9] 没有任何记录');
{
  const s = F.summarize({ txns: [], limit: 3000, windowDays: 14, now: new Date(2026, 9, 15) });
  ok('hasData=false', () => assert.equal(s.hasData, false));
  ok('今日额度 = 3000/17', () => near(s.allowanceToday, 3000 / 17, 0.01));
  ok('今天还能花等于额度', () => near(s.todayLeft, s.allowanceToday, 0.01));
}

console.log('\n[10] 跨月、跨年、天数');
{
  ok('1 月往前推是上一年 12 月', () => {
    assert.deepEqual(F.shiftMonth(2026, 1, -1), { year: 2025, month: 12 });
  });
  ok('12 月往后推是下一年 1 月', () => {
    assert.deepEqual(F.shiftMonth(2026, 12, 1), { year: 2027, month: 1 });
  });
  ok('2 月天数', () => {
    assert.equal(F.daysInMonth(2026, 2), 28);
    assert.equal(F.daysInMonth(2028, 2), 29);
  });
}

console.log('\n[11] 按天分组');
{
  const list = [tx('2026-10-02', 10), tx('2026-10-02', 20), tx('2026-10-01', 5)];
  const g = F.groupByDay(list);
  ok('两天两组', () => assert.equal(g.length, 2));
  ok('按日期倒序', () => assert.equal(g[0].date, '2026-10-02'));
  ok('组内合计 30', () => assert.equal(g[0].total, 30));
}

console.log('\n[12] 分类合计与金额精度');
{
  const txns = [tx('2026-10-01', 0.1, 'food'), tx('2026-10-01', 0.2, 'food'), tx('2026-10-02', 5, 'transport')];
  const s = F.summarize({ txns, limit: 0, windowDays: 14, now: new Date(2026, 9, 2) });
  ok('0.1 + 0.2 + 5 = 5.3（无浮点误差）', () => assert.equal(s.spent, 5.3));
  ok('两个分类，金额大的在前', () => {
    assert.equal(s.categories.length, 2);
    assert.equal(s.categories[0].id, 'transport');
    assert.equal(s.categories[1].id, 'food');
    near(s.categories[1].amount, 0.3, 0.001);
  });
}

console.log('\n通过 ' + passed + ' 项\n');
