/* 月衡 · 数据层
 * 全部存在 localStorage，不上传任何服务器。
 */
(function (global) {
  'use strict';

  var KEY = 'yueheng.state.v1';
  var VERSION = 1;

  var CATEGORIES = [
    { id: 'food',      name: '餐饮', icon: '🍜' },
    { id: 'transport', name: '交通', icon: '🚇' },
    { id: 'shopping',  name: '购物', icon: '🛍️' },
    { id: 'fun',       name: '娱乐', icon: '🎮' },
    { id: 'home',      name: '居家', icon: '🏠' },
    { id: 'health',    name: '医疗', icon: '💊' },
    { id: 'other',     name: '其他', icon: '📦' }
  ];

  function catOf(id) {
    for (var i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i].id === id) return CATEGORIES[i];
    return CATEGORIES[CATEGORIES.length - 1];
  }

  function defaults() {
    return { version: VERSION, limit: 0, windowDays: 14, txns: [] };
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function cleanTxn(t) {
    if (!t || typeof t !== 'object') return null;
    var amount = Number(t.amount);
    if (!isFinite(amount) || amount <= 0) return null;
    var date = typeof t.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.date) ? t.date : null;
    if (!date) return null;
    return {
      id: typeof t.id === 'string' && t.id ? t.id : uid(),
      amount: Math.round(amount * 100) / 100,
      category: typeof t.category === 'string' ? t.category : 'other',
      note: typeof t.note === 'string' ? t.note.slice(0, 60) : '',
      date: date,
      ts: isFinite(Number(t.ts)) ? Number(t.ts) : Date.now()
    };
  }

  function normalize(raw) {
    var base = defaults();
    if (!raw || typeof raw !== 'object') return base;
    var limit = Number(raw.limit);
    base.limit = isFinite(limit) && limit >= 0 ? Math.round(limit * 100) / 100 : base.limit;
    var w = raw.windowDays;
    base.windowDays = (w === 'month' || [7, 14, 30].indexOf(Number(w)) >= 0) ? (w === 'month' ? 'month' : Number(w)) : base.windowDays;
    var list = Array.isArray(raw.txns) ? raw.txns : [];
    var seen = {};
    for (var i = 0; i < list.length; i++) {
      var t = cleanTxn(list[i]);
      if (t && !seen[t.id]) { seen[t.id] = 1; base.txns.push(t); }
    }
    return base;
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      return normalize(JSON.parse(raw));
    } catch (e) {
      return defaults();
    }
  }

  function save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        version: VERSION, limit: state.limit, windowDays: state.windowDays, txns: state.txns
      }));
      return true;
    } catch (e) {
      return false;
    }
  }

  function addTxn(state, data) {
    var t = cleanTxn({
      id: uid(),
      amount: data.amount,
      category: data.category,
      note: data.note,
      date: data.date,
      ts: Date.now()
    });
    if (!t) return null;
    state.txns.push(t);
    return t;
  }

  function removeTxn(state, id) {
    var before = state.txns.length;
    state.txns = state.txns.filter(function (t) { return t.id !== id; });
    return state.txns.length !== before;
  }

  function exportJSON(state) {
    return JSON.stringify({
      app: 'yueheng',
      version: VERSION,
      exportedAt: new Date().toISOString(),
      limit: state.limit,
      windowDays: state.windowDays,
      txns: state.txns
    }, null, 2);
  }

  /** 合并导入：同 id 视为同一条，其余追加；返回 {added, merged, limit} */
  function importJSON(state, text) {
    var raw = JSON.parse(text);
    if (!raw || typeof raw !== 'object') throw new Error('不是有效的备份文件');
    var incoming = Array.isArray(raw.txns) ? raw.txns : (Array.isArray(raw) ? raw : null);
    if (!incoming) throw new Error('备份里没有记录');

    var added = 0;
    var merged = 0;
    var byId = {};
    for (var i = 0; i < state.txns.length; i++) byId[state.txns[i].id] = true;
    for (var j = 0; j < incoming.length; j++) {
      var t = cleanTxn(incoming[j]);
      if (!t) continue;
      if (byId[t.id]) { merged++; continue; }
      byId[t.id] = true;
      state.txns.push(t);
      added++;
    }
    if (isFinite(Number(raw.limit)) && Number(raw.limit) >= 0) state.limit = Math.round(Number(raw.limit) * 100) / 100;
    if (raw.windowDays === 'month' || [7, 14, 30].indexOf(Number(raw.windowDays)) >= 0) {
      state.windowDays = raw.windowDays === 'month' ? 'month' : Number(raw.windowDays);
    }
    return { added: added, merged: merged };
  }

  /** 演示数据：只用于 ?demo=1，不会写进 localStorage */
  function demoState() {
    var now = new Date();
    var y = now.getFullYear();
    var m = now.getMonth() + 1;
    var today = now.getDate();
    var plan = [38, 62, 24, 118, 45, 30, 76, 52, 19, 88, 64, 41, 27, 55, 96, 33, 71, 48, 22, 67, 39, 84, 58, 31, 44, 73, 25, 51, 36];
    var cats = ['food', 'transport', 'shopping', 'fun', 'home', 'health', 'other'];
    var samples = {
      food: ['早饭 豆浆油条', '午饭 面条', '晚饭 盖饭', '奶茶', '水果', '便利店'],
      transport: ['地铁', '公交', '打车', '共享单车', '高铁票'],
      shopping: ['超市采购', '洗衣液', '袜子', '日用品'],
      fun: ['电影票', '剧本杀', '游戏点卡'],
      home: ['水电费', '纸巾', '房租'],
      health: ['维生素', '感冒药', '体检'],
      other: ['话费', '快递', '理发']
    };
    var txns = [];
    for (var d = 1; d <= Math.min(today, plan.length); d++) {
      var count = (d % 3 === 0) ? 2 : 1;
      for (var c = 0; c < count; c++) {
        var amount = c === 0 ? plan[d - 1] : Math.round(plan[d - 1] * 0.4 * 100) / 100;
        var cat = cats[(d * 3 + c * 5) % cats.length];
        var pool = samples[cat];
        txns.push({
          id: 'demo-' + d + '-' + c,
          amount: Math.max(3, amount),
          category: cat,
          note: pool[(d + c) % pool.length],
          date: y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0'),
          ts: new Date(y, m - 1, d, 9 + c * 6).getTime()
        });
      }
    }
    return { version: VERSION, limit: 3000, windowDays: 14, txns: txns };
  }

  global.Store = {
    KEY: KEY,
    CATEGORIES: CATEGORIES,
    catOf: catOf,
    defaults: defaults,
    normalize: normalize,
    load: load,
    save: save,
    addTxn: addTxn,
    removeTxn: removeTxn,
    exportJSON: exportJSON,
    importJSON: importJSON,
    demoState: demoState,
    uid: uid
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
