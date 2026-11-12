/* QuoteFlow pricing, rules, approvals, revenue and analytics engine. Pure functions, no DOM. */
(function (root) {
  const D = root.QF_DATA;
  const byCode = Object.fromEntries(D.products.map((p) => [p.code, p]));
  const round2 = (x) => Math.round(x * 100) / 100;

  function volumeDiscount(qty) {
    let d = 0;
    for (const t of D.volumeTiers) if (qty >= t.min) d = t.discount;
    return d;
  }

  function hasAll(q, codes) { const set = new Set(q.lines.map((l) => l.code)); return codes.every((c) => set.has(c)); }

  // Price a quote. All money in USD; convert with toCurrency() for display.
  function price(q) {
    const sla = D.slaTiers[q.sla] || D.slaTiers.Standard;
    const bundle = q.bundle ? D.bundles.find((b) => b.code === q.bundle) : null;
    const bundleOn = bundle && hasAll(q, bundle.items);
    let monthlyList = 0, monthlyNet = 0, monthlyCost = 0, oneTimeList = 0, oneTimeNet = 0, oneTimeCost = 0;
    const lines = q.lines.map((l) => {
      const p = byCode[l.code];
      if (!p) return null;
      const qty = Math.max(0, Number(l.qty) || 0);
      const uplift = p.type === 'usage' ? sla.uplift : 0;
      const listUnit = p.price * (1 + uplift);
      const vol = p.volumeTiered ? volumeDiscount(qty) : 0;
      const bun = bundleOn && bundle.items.includes(p.code) ? bundle.discount : 0;
      const pre = { listUnit, vol, bun, qty, p };
      return pre;
    }).filter(Boolean);
    const listMonthlyPre = lines.reduce((s, x) => s + (x.p.billing === 'one-time' ? 0 : x.listUnit * x.qty), 0);
    const commit = listMonthlyPre >= D.policy.commitmentBonus.minMonthlyUSD ? D.policy.commitmentBonus.extra : 0;
    const manual = Math.min(0.5, Math.max(0, Number(q.manualDiscount) || 0));
    const out = lines.map((x) => {
      const netUnit = x.listUnit * (1 - x.vol) * (1 - x.bun) * (1 - commit) * (1 - manual);
      const list = x.listUnit * x.qty, net = netUnit * x.qty;
      const cost = x.p.cost * (x.p.type === 'usage' ? 1 + (D.slaTiers[q.sla] || D.slaTiers.Standard).uplift * 0.5 : 1) * x.qty;
      if (x.p.billing === 'one-time') { oneTimeList += list; oneTimeNet += net; oneTimeCost += cost; }
      else { monthlyList += list; monthlyNet += net; monthlyCost += cost; }
      return { code: x.p.code, name: x.p.name, type: x.p.type, billing: x.p.billing || 'monthly', unit: x.p.unit || (x.p.billing === 'one-time' ? 'one-time' : 'month'), qty: x.qty, listUnit: x.listUnit, netUnit, list, net, cost, discounts: { volume: x.vol, bundle: x.bun, commitment: commit, manual } };
    });
    const term = Number(q.termMonths) || 12;
    const contractList = monthlyList * term + oneTimeList;
    const contractNet = monthlyNet * term + oneTimeNet;
    const contractCost = monthlyCost * term + oneTimeCost;
    const margin = contractNet > 0 ? (contractNet - contractCost) / contractNet : 0;
    const totalDiscount = contractList > 0 ? 1 - contractNet / contractList : 0;
    const ent = D.entities[q.entity] || D.entities.US;
    return { lines: out, monthlyList, monthlyNet, monthlyCost, oneTimeList, oneTimeNet, oneTimeCost, contractList, contractNet, contractCost, margin, totalDiscount, manual, commitment: commit, bundleApplied: !!bundleOn, taxRate: ent.taxRate, taxName: ent.taxName, monthlyTax: monthlyNet * ent.taxRate, term };
  }

  // Product (configuration) rules.
  function validate(q) {
    const errors = [];
    if (!q.client || !q.client.trim()) errors.push('Add a client name.');
    if (!q.lines.length) errors.push('Add at least one service.');
    if (q.freshSKUs && !hasAll(q, ['CHL-STO'])) errors.push('Fresh or chilled SKUs need Chilled storage (CHL-STO).');
    if (hasAll(q, ['DS-FUL']) && !hasAll(q, ['INB-UNIT'])) errors.push('Dark-store fulfillment needs Inbound handling (INB-UNIT).');
    if (q.lines.some((l) => !(Number(l.qty) > 0))) errors.push('Every service needs a quantity above zero.');
    return errors;
  }

  function clauseFlags(q) {
    return D.clauses.map((c) => { const f = c.check(q, D.slaTiers); return f ? { id: c.id, name: c.name, standard: c.standard, risk: f.risk, reason: f.reason } : null; }).filter(Boolean);
  }

  // Approval chain from policy.
  function approvalSteps(q, pr) {
    const steps = [];
    const p = D.policy;
    if (pr.manual > p.dealDeskAbove) steps.push({ step: 'deal', role: 'Deal desk', why: 'Discount of ' + pct(pr.manual) + ' is above ' + pct(p.dealDeskAbove) + '.' });
    if (pr.manual > p.financeAbove || pr.margin < p.marginFloor) steps.push({ step: 'finance', role: 'Finance', why: pr.margin < p.marginFloor ? 'Margin of ' + pct(pr.margin) + ' is below the ' + pct(p.marginFloor) + ' floor.' : 'Discount of ' + pct(pr.manual) + ' is above ' + pct(p.financeAbove) + '.' });
    const flags = clauseFlags(q);
    if (flags.length) steps.push({ step: 'legal', role: 'Legal', why: flags.length + ' non-standard clause' + (flags.length > 1 ? 's' : '') + ' to review.' });
    return steps;
  }

  function sizeOf(listMonthlyUSD) { return listMonthlyUSD >= 100000 ? 'large' : listMonthlyUSD >= 30000 ? 'medium' : 'small'; }

  // Simulated discount model: win rate by discount band for similar-size deals in history, times margin at that discount.
  function suggestDiscount(q, pr) {
    const size = sizeOf(pr.monthlyList);
    const bands = [[0, 0.05], [0.05, 0.10], [0.10, 0.15], [0.15, 0.20], [0.20, 0.30]];
    const hist = D.history.filter((h) => h.size === size);
    const costRatio = pr.contractList > 0 ? pr.contractCost / (pr.contractList * (1 - (pr.totalDiscount - pr.manual))) : 0.65;
    let best = null;
    const rows = bands.map(([a, b]) => {
      const inBand = hist.filter((h) => h.discount >= a && h.discount < b);
      const won = inBand.filter((h) => h.won).length;
      const winRate = (won + 1) / (inBand.length + 2); // smoothed
      const mid = (a + b) / 2;
      const margin = 1 - costRatio / (1 - mid);
      const score = winRate * Math.max(0, margin);
      const row = { from: a, to: b, deals: inBand.length, winRate, margin, score };
      if (!best || score > best.score) best = row;
      return row;
    });
    return { size, bands: rows, best };
  }

  // Revenue recognition schedule (ASC 606 / IFRS 15, simplified for the prototype).
  function revRec(q, pr) {
    const rows = [];
    const fixedMonthly = pr.lines.filter((l) => l.type === 'fixed' && l.billing === 'monthly').reduce((s, l) => s + l.net, 0);
    const usageMonthly = pr.lines.filter((l) => l.type === 'usage').reduce((s, l) => s + l.net, 0);
    const oneTime = pr.oneTimeNet;
    for (let m = 1; m <= pr.term; m++) {
      rows.push({ month: m, fixed: fixedMonthly + oneTime / pr.term, usage: usageMonthly, total: fixedMonthly + oneTime / pr.term + usageMonthly });
    }
    return { rows, note: 'Fixed fees and onboarding recognized evenly over the term; usage recognized as fulfilled (forecast shown).' };
  }

  // Simulated WMS actuals for reconciliation, deterministic per quote.
  function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function reconcile(q, pr, months) {
    let s = hash(q.id);
    const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const out = [];
    for (let m = 1; m <= months; m++) {
      for (const l of pr.lines.filter((x) => x.type === 'usage')) {
        const billedQty = l.qty;
        const actualQty = Math.round(l.qty * (1 + (r() - 0.45) * 0.14));
        const variance = billedQty ? (actualQty - billedQty) / billedQty : 0;
        out.push({ key: q.id + '-' + m + '-' + l.code, month: m, code: l.code, name: l.name, unit: l.unit, billedQty, actualQty, variance, amount: (actualQty - billedQty) * l.netUnit, exception: Math.abs(variance) > D.policy.reconTolerance });
      }
    }
    return out;
  }

  // Analytics over history plus closed quotes.
  function analytics(records) {
    const closed = records.filter((r) => r.won === true || r.won === false);
    const won = closed.filter((r) => r.won).length;
    const winRate = closed.length ? won / closed.length : 0;
    const leakRows = records.filter((r) => r.discount > r.suggested);
    const leakPct = records.length ? records.reduce((s, r) => s + Math.max(0, r.discount - r.suggested), 0) / records.length : 0;
    const leakUSD = records.reduce((s, r) => s + Math.max(0, r.discount - r.suggested) * r.listMonthlyUSD, 0);
    const timed = records.filter((r) => r.approvalHours != null);
    const cycle = timed.length ? timed.reduce((s, r) => s + r.approvalHours, 0) / timed.length : 0;
    const svc = {};
    for (const r of records) {
      for (const [code, share] of Object.entries(r.mix || {})) {
        const p = byCode[code]; if (!p || !share) continue;
        const rev = r.listMonthlyUSD * share * (1 - r.discount);
        const cost = r.listMonthlyUSD * share * (p.cost / p.price);
        svc[code] = svc[code] || { code, name: p.name, rev: 0, cost: 0 };
        svc[code].rev += rev; svc[code].cost += cost;
      }
    }
    const marginBySvc = Object.values(svc).map((x) => ({ ...x, margin: x.rev ? (x.rev - x.cost) / x.rev : 0 })).sort((a, b) => b.margin - a.margin);
    return { winRate, won, closed: closed.length, leakPct, leakUSD, leakCount: leakRows.length, cycle, marginBySvc, count: records.length };
  }

  function pct(x, d) { return (x * 100).toFixed(d == null ? 1 : d) + '%'; }
  function toCurrency(usd, cur, perUSD) {
    const c = D.currencies[cur] || D.currencies.USD;
    const v = usd * (perUSD || c.perUSD);
    return c.symbol + ' ' + v.toLocaleString('en-US', { minimumFractionDigits: c.decimals, maximumFractionDigits: c.decimals });
  }

  root.QF = { price, validate, clauseFlags, approvalSteps, suggestDiscount, revRec, reconcile, analytics, sizeOf, pct, toCurrency, byCode, round2, volumeDiscount };
})(typeof window !== 'undefined' ? window : globalThis);
