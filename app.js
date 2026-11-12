/* QuoteFlow UI. Vanilla JS, state kept in the browser (localStorage). */
(function () {
  const D = window.QF_DATA, E = window.QF;
  const KEY = 'quoteflow-demo-v1';
  const $ = (s, el) => (el || document).querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const userById = (id) => D.users.find((u) => u.id === id) || { name: id, role: '' };
  const now = () => Date.now();
  const fmtTime = (t) => new Date(t).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  // ---------- State ----------
  function blankQuote(id, by) {
    return {
      id, client: '', entity: 'ID', termMonths: 12, sla: 'Standard', freshSKUs: false, bundle: '', manualDiscount: 0,
      lines: [{ code: 'FUL-ORD', qty: 100000 }, { code: 'STO-PAL', qty: 30000 }, { code: 'INB-UNIT', qty: 150000 }, { code: 'ONB', qty: 1 }],
      clauses: { slaPenalty: 2, liabilityMonths: 12, terminationDays: 90, standardDPA: true },
      status: 'Draft', createdBy: by, createdAt: now(), approvals: [], audit: [{ at: now(), by, action: 'Created', detail: 'Draft quote created.' }],
      fx: null, submittedAt: null, approvedAt: null, contract: null, legal: {}, handoff: null, recon: {}, suggestedAtSubmit: null,
    };
  }
  function seed() {
    const t = now();
    const won = blankQuote('Q-1999', 'ana');
    Object.assign(won, {
      client: 'Arunika Foods (demo)', entity: 'ID', termMonths: 24, sla: 'Premium', freshSKUs: true, bundle: 'PKG-DARK', manualDiscount: 0.12,
      lines: [{ code: 'DS-FUL', qty: 220000 }, { code: 'CHL-STO', qty: 18000 }, { code: 'INB-UNIT', qty: 400000 }, { code: 'STO-PAL', qty: 25000 }, { code: 'ONB', qty: 1 }],
      createdAt: t - 9 * 864e5,
    });
    submit(won, 'ana', t - 8 * 864e5);
    const reasons = { 'Deal desk': ['dev', 'Strategic grocery logo; volume above 200k orders.'], Finance: ['fatima', 'Margin accepted for a 24-month strategic contract.'], Legal: ['leo', 'Clauses reviewed.'] };
    won.approvals.forEach((a, i) => { const [by, why] = reasons[a.role]; a.status = 'Approved'; a.by = by; a.at = t - (7.8 - i * 0.2) * 864e5; a.reason = why; won.audit.push({ at: a.at, by, action: 'Approved (' + a.role + ')', detail: why }); });
    if (won.status !== 'Approved') { won.status = 'Approved'; won.approvedAt = t - 7.4 * 864e5; won.fx = D.currencies.IDR.perUSD; won.audit.push({ at: won.approvedAt, by: 'system', action: 'FX locked', detail: '1 USD = 16,300 IDR (demo rate).' }); }
    issueContract(won, 'ana', t - 7 * 864e5);
    closeWon(won, 'ana', t - 6 * 864e5);
    won.handoff.billing.status = 'Completed';

    const pend = blankQuote('Q-2000', 'sam');
    Object.assign(pend, {
      client: 'Volt Mobile (demo)', entity: 'IN', termMonths: 12, sla: 'Standard', manualDiscount: 0.15,
      lines: [{ code: 'FUL-ORD', qty: 80000 }, { code: 'STO-PAL', qty: 12000 }, { code: 'INB-UNIT', qty: 90000 }, { code: 'VAS-KIT', qty: 40000 }, { code: 'ONB', qty: 1 }],
      clauses: { slaPenalty: 2, liabilityMonths: 18, terminationDays: 60, standardDPA: true }, createdAt: t - 2 * 864e5,
    });
    submit(pend, 'sam', t - 1.2 * 864e5);
    return { quotes: [won, pend], user: 'ana', view: 'quotes', selected: null, seq: 2001, filters: { rep: 'all', currency: 'all', period: 'all' }, drill: null };
  }
  let S = null;
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable: keep in memory */ } }

  const me = () => userById(S.user);
  const canQuote = () => ['Sales rep', 'Deal desk'].includes(me().role);
  const getQ = (id) => S.quotes.find((q) => q.id === id);
  const cur = (q) => (D.entities[q.entity] || D.entities.US).currency;
  const money = (usd, q) => E.toCurrency(usd, cur(q), q.fx || null);
  function log(q, by, action, detail, at) { q.audit.push({ at: at || now(), by, action, detail }); }

  // ---------- Workflow ----------
  function editable(q) { return ['Draft', 'Rejected', 'Approved'].includes(q.status) && canQuote(); }
  function touch(q) {
    if (q.status === 'Approved' || q.status === 'Rejected') {
      log(q, S.user, 'Edited after ' + q.status.toLowerCase(), 'Quote returned to Draft; re-approval required.');
      q.status = 'Draft'; q.approvals = []; q.fx = null; q.approvedAt = null; q.legal = {};
    }
  }
  function submit(q, by, at) {
    const pr = E.price(q), steps = E.approvalSteps(q, pr), sug = E.suggestDiscount(q, pr);
    q.submittedAt = at || now();
    q.suggestedAtSubmit = sug.best ? (sug.best.from + sug.best.to) / 2 : 0;
    if (!steps.length) {
      q.status = 'Approved'; q.approvedAt = q.submittedAt; q.fx = D.currencies[cur(q)].perUSD; q.approvals = [];
      log(q, by, 'Submitted', 'Within policy: auto-approved.', q.submittedAt);
      log(q, 'system', 'FX locked', '1 USD = ' + q.fx.toLocaleString('en-US') + ' ' + cur(q) + ' (demo rate).', q.submittedAt);
      return;
    }
    q.status = 'Pending approval';
    q.approvals = steps.map((s) => ({ ...s, status: 'Pending', by: null, at: null, reason: '' }));
    log(q, by, 'Submitted', 'Sent for approval: ' + steps.map((s) => s.role).join(', ') + '.', q.submittedAt);
  }
  function decide(q, step, ok, reason) {
    const a = q.approvals.find((x) => x.step === step);
    a.status = ok ? 'Approved' : 'Rejected'; a.by = S.user; a.at = now(); a.reason = reason;
    log(q, S.user, (ok ? 'Approved' : 'Rejected') + ' (' + a.role + ')', reason || '(no reason given)');
    if (!ok) { q.status = 'Rejected'; return; }
    if (q.approvals.every((x) => x.status === 'Approved')) {
      q.status = 'Approved'; q.approvedAt = now(); q.fx = D.currencies[cur(q)].perUSD;
      log(q, 'system', 'FX locked', '1 USD = ' + q.fx.toLocaleString('en-US') + ' ' + cur(q) + ' (demo rate).');
    }
  }
  function issueContract(q, by, at) {
    const pr = E.price(q);
    q.contract = { number: 'C-' + q.id.slice(2), issuedAt: at || now(), terms: { term: q.termMonths, sla: q.sla, monthlyNet: pr.monthlyNet, oneTime: pr.oneTimeNet }, flags: E.clauseFlags(q) };
    q.status = 'Contract issued';
    log(q, by, 'Contract generated', q.contract.number + ' generated from approved terms.', at);
  }
  function closeWon(q, by, at) {
    const pr = E.price(q), t = at || now();
    q.status = 'Closed Won'; q.outcome = 'won'; q.closedAt = t;
    q.handoff = {
      wms: { mode: 'Synchronous', at: t, response: '200 OK · client WMS-' + q.id.slice(2) + ' created; rates and SLA active (simulated)', payload: { client: q.client, entity: q.entity, currency: cur(q), sla: q.sla, effectiveFrom: new Date(t).toISOString().slice(0, 10), services: pr.lines.map((l) => ({ code: l.code, unit: l.unit, rateUSD: E.round2(l.netUnit), monthlyVolume: l.qty })) } },
      billing: { mode: 'Asynchronous', job: 'BILL-' + q.id.slice(2) + '-' + String(t).slice(-4), queuedAt: t, status: 'Queued' },
      sap: { mode: 'Mock endpoint', posted: t, document: 'RR-' + q.id.slice(2), response: '201 Created · revenue schedule received (mock SAP)' },
    };
    log(q, by, 'Closed Won', 'Handoff sent: WMS setup (sync), billing rates (async), revenue schedule to SAP (mock).', t);
  }

  // ---------- Rendering ----------
  const VIEWS = [['quotes', 'Quotes'], ['approvals', 'Approvals'], ['contracts', 'Contracts & Legal'], ['handoff', 'Handoff & revenue'], ['recon', 'Usage reconciliation'], ['analytics', 'Analytics'], ['catalog', 'Catalog & rules']];

  function render() {
    // Billing jobs complete a few seconds after queuing (simulated async).
    S.quotes.forEach((q) => { if (q.handoff && q.handoff.billing.status === 'Queued' && now() - q.handoff.billing.queuedAt > 4000) { q.handoff.billing.status = 'Completed'; q.handoff.billing.doneAt = now(); log(q, 'system', 'Billing sync completed', q.handoff.billing.job + ' processed.'); } });
    save();
    $('#user').innerHTML = D.users.map((u) => '<option value="' + u.id + '"' + (u.id === S.user ? ' selected' : '') + '>' + esc(u.name) + ' · ' + esc(u.role) + '</option>').join('');
    const pendingForMe = S.quotes.filter((q) => q.status === 'Pending approval' && q.approvals.some((a) => a.status === 'Pending' && a.role === me().role)).length;
    $('#tabs').innerHTML = VIEWS.map(([id, label]) => '<button class="tab' + (S.view === id && !S.selected ? ' on' : '') + '" data-view="' + id + '">' + label + (id === 'approvals' && pendingForMe ? ' <span class="badge">' + pendingForMe + '</span>' : '') + '</button>').join('');
    const main = $('#main');
    if (S.selected && getQ(S.selected)) main.innerHTML = viewQuote(getQ(S.selected));
    else main.innerHTML = ({ quotes: viewQuotes, approvals: viewApprovals, contracts: viewContracts, handoff: viewHandoff, recon: viewRecon, analytics: viewAnalytics, catalog: viewCatalog }[S.view] || viewQuotes)();
  }

  const statusPill = (s) => '<span class="pill s-' + s.toLowerCase().replace(/\s+/g, '-') + '">' + esc(s) + '</span>';

  function viewQuotes() {
    const rows = S.quotes.slice().sort((a, b) => b.createdAt - a.createdAt).map((q) => {
      const pr = E.price(q);
      return '<tr class="click" data-open="' + q.id + '"><td><b>' + q.id + '</b></td><td>' + esc(q.client || '(no client yet)') + '</td><td>' + esc(userById(q.createdBy).name) + '</td><td>' + cur(q) + '</td><td class="num">' + money(pr.monthlyNet, q) + '</td><td class="num ' + (pr.margin < D.policy.marginFloor ? 'bad' : '') + '">' + E.pct(pr.margin) + '</td><td>' + statusPill(q.status) + '</td></tr>';
    }).join('');
    return '<div class="head"><h2>Quotes</h2>' + (canQuote() ? '<button class="btn primary" data-act="new">New quote</button>' : '<span class="muted">Switch to a sales rep or deal desk user to create quotes.</span>') + '</div>' +
      '<div class="card"><table><thead><tr><th>Quote</th><th>Client</th><th>Owner</th><th>Currency</th><th class="num">Monthly net</th><th class="num">Margin</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function viewQuote(q) {
    const pr = E.price(q), errs = E.validate(q), steps = E.approvalSteps(q, pr), sug = E.suggestDiscount(q, pr), flags = E.clauseFlags(q);
    const ed = editable(q), dis = ed ? '' : ' disabled';
    const prodOpts = (sel) => D.products.map((p) => '<option value="' + p.code + '"' + (p.code === sel ? ' selected' : '') + '>' + p.code + ' · ' + esc(p.name) + '</option>').join('');
    const lineRows = q.lines.map((l, i) => {
      const pl = pr.lines[i]; const p = E.byCode[l.code];
      return '<tr><td><select data-line="' + i + '" data-f="code"' + dis + '>' + prodOpts(l.code) + '</select></td><td><input type="number" min="0" step="1" data-line="' + i + '" data-f="qty" value="' + l.qty + '"' + dis + '> <span class="muted">' + esc(p ? (p.unit || (p.billing === 'one-time' ? 'one-time' : 'per month')) : '') + (p && p.type === 'usage' ? ' / month' : '') + '</span></td>' +
        '<td class="num">' + (pl ? money(pl.listUnit, q) : '') + '</td><td class="num">' + (pl ? money(pl.netUnit, q) : '') + '</td><td class="num">' + (pl ? money(pl.net, q) : '') + '</td><td>' + (ed ? '<button class="x" data-del="' + i + '" aria-label="Remove line">×</button>' : '') + '</td></tr>';
    }).join('');
    const ent = D.entities[q.entity];
    const marginPct = Math.max(0, Math.min(1, pr.margin));
    const bandRows = sug.bands.map((b) => '<tr' + (b === sug.best ? ' class="best"' : '') + '><td>' + Math.round(b.from * 100) + '–' + Math.round(b.to * 100) + '%</td><td class="num">' + b.deals + '</td><td class="num">' + E.pct(b.winRate, 0) + '</td><td class="num">' + E.pct(b.margin, 0) + '</td></tr>').join('');
    const actions = [];
    if (ed) actions.push('<button class="btn" data-act="save">Save</button>', '<button class="btn primary" data-act="submit"' + (errs.length ? ' disabled' : '') + '>Submit for approval</button>');
    if (q.status === 'Approved' && canQuote()) actions.push('<button class="btn primary" data-act="contract">Generate contract</button>');
    if (q.status === 'Contract issued' && canQuote()) actions.push('<button class="btn primary" data-act="won">Mark Closed Won</button>', '<button class="btn" data-act="lost">Mark Closed Lost</button>');
    if (['Draft', 'Rejected', 'Approved'].includes(q.status) && canQuote()) actions.push('<button class="btn ghost" data-act="lost">Closed Lost</button>');

    return '<div class="head"><button class="btn ghost" data-act="back">← All quotes</button><h2>' + q.id + ' · ' + esc(q.client || 'New quote') + '</h2>' + statusPill(q.status) + '</div>' +
      (!ed && ['Draft', 'Rejected', 'Approved'].includes(q.status) ? '<p class="note">Read-only for ' + esc(me().role) + '. Switch to a sales rep to edit.</p>' : '') +
      (q.status === 'Approved' ? '<p class="note">Editing an approved quote sends it back to Draft and needs re-approval.</p>' : '') +
      '<div class="grid2"><div>' +
      '<div class="card"><h3>Deal</h3><div class="form">' +
      '<label>Client<input data-q="client" value="' + esc(q.client) + '" placeholder="Client name"' + dis + '></label>' +
      '<label>Billing entity<select data-q="entity"' + dis + '>' + Object.entries(D.entities).map(([k, v]) => '<option value="' + k + '"' + (k === q.entity ? ' selected' : '') + '>' + esc(v.label) + ' (' + v.currency + ')</option>').join('') + '</select></label>' +
      '<label>Term<select data-q="termMonths"' + dis + '>' + [12, 24, 36].map((m) => '<option' + (m == q.termMonths ? ' selected' : '') + '>' + m + '</option>').join('') + '</select></label>' +
      '<label>SLA tier<select data-q="sla"' + dis + '>' + Object.keys(D.slaTiers).map((k) => '<option' + (k === q.sla ? ' selected' : '') + '>' + k + '</option>').join('') + '</select></label>' +
      '<label>Bundle<select data-q="bundle"' + dis + '><option value="">None</option>' + D.bundles.map((b) => '<option value="' + b.code + '"' + (b.code === q.bundle ? ' selected' : '') + '>' + esc(b.name) + ' (−' + Math.round(b.discount * 100) + '%)</option>').join('') + '</select></label>' +
      '<label class="check"><input type="checkbox" data-q="freshSKUs"' + (q.freshSKUs ? ' checked' : '') + dis + '> Client stores fresh or chilled SKUs</label>' +
      '</div></div>' +
      '<div class="card"><h3>Services</h3><table class="lines"><thead><tr><th>Service</th><th>Quantity</th><th class="num">List / unit</th><th class="num">Net / unit</th><th class="num">Line total</th><th></th></tr></thead><tbody>' + lineRows + '</tbody></table>' + (ed ? '<button class="btn small" data-act="addline">+ Add service</button>' : '') + '</div>' +
      '<div class="card"><h3>Discount</h3><div class="form"><label>Rep discount (%)<input type="number" min="0" max="50" step="0.5" data-q="manualDiscount" value="' + E.round2(q.manualDiscount * 100) + '"' + dis + '></label></div>' +
      '<div class="ai"><div class="ai-head"><b>Suggested discount: ' + Math.round(sug.best.from * 100) + '–' + Math.round(sug.best.to * 100) + '%</b><span class="muted"> · simulated model on demo history (' + sug.size + ' deals)</span></div>' +
      '<table class="mini"><thead><tr><th>Band</th><th class="num">Past deals</th><th class="num">Win rate</th><th class="num">Margin</th></tr></thead><tbody>' + bandRows + '</tbody></table>' +
      (ed ? '<button class="btn small" data-act="applysug">Apply ' + E.pct((sug.best.from + sug.best.to) / 2, 1) + '</button>' : '') + '<p class="muted small">The suggestion never approves anything: discounts above threshold still go through the approval chain.</p></div></div>' +
      '<div class="card"><h3>Contract terms</h3><div class="form">' +
      '<label>SLA penalty (% of monthly fees)<input type="number" min="0" max="30" data-c="slaPenalty" value="' + q.clauses.slaPenalty + '"' + dis + '></label>' +
      '<label>Liability cap (months of fees)<input type="number" min="1" max="60" data-c="liabilityMonths" value="' + q.clauses.liabilityMonths + '"' + dis + '></label>' +
      '<label>Termination notice (days)<input type="number" min="0" max="365" data-c="terminationDays" value="' + q.clauses.terminationDays + '"' + dis + '></label>' +
      '<label class="check"><input type="checkbox" data-c="standardDPA"' + (q.clauses.standardDPA ? ' checked' : '') + dis + '> Standard data processing addendum</label></div>' +
      (flags.length ? '<div class="flags">' + flags.map((f) => '<div class="flag r-' + f.risk.toLowerCase() + '"><b>' + esc(f.name) + ' · ' + f.risk + '</b><span>' + esc(f.reason) + '</span></div>').join('') + '</div>' : '<p class="ok">All clauses match the standard library.</p>') + '</div>' +
      '</div><div>' +
      '<div class="card sticky"><h3>Summary · ' + cur(q) + (q.fx ? ' <span class="muted small">(FX locked)</span>' : '') + '</h3>' +
      '<dl class="sum"><dt>Monthly list</dt><dd>' + money(pr.monthlyList, q) + '</dd><dt>Monthly net</dt><dd><b>' + money(pr.monthlyNet, q) + '</b></dd><dt>' + esc(ent.taxName) + ' (' + E.pct(ent.taxRate, 0) + ')</dt><dd>' + money(pr.monthlyTax, q) + '</dd><dt>One-time</dt><dd>' + money(pr.oneTimeNet, q) + '</dd><dt>Contract value (' + pr.term + ' mo)</dt><dd><b>' + money(pr.contractNet, q) + '</b></dd><dt>Total discount off list</dt><dd>' + E.pct(pr.totalDiscount) + '</dd></dl>' +
      '<div class="breakdown muted small">Volume tiers on order lines · bundle ' + (pr.bundleApplied ? 'applied' : 'not applied') + ' · commitment bonus ' + (pr.commitment ? E.pct(pr.commitment, 0) : 'none') + ' · rep discount ' + E.pct(pr.manual) + '</div>' +
      '<div class="marginbar"><div class="mlabel">Margin <b class="' + (pr.margin < D.policy.marginFloor ? 'bad' : 'good') + '">' + E.pct(pr.margin) + '</b> <span class="muted">floor ' + E.pct(D.policy.marginFloor, 0) + '</span></div><div class="track"><i style="width:' + (marginPct * 100).toFixed(1) + '%"></i><em style="left:' + (D.policy.marginFloor * 100) + '%"></em></div></div>' +
      (errs.length ? '<div class="errs">' + errs.map((e) => '<p>⚠ ' + esc(e) + '</p>').join('') + '</div>' : '') +
      '<h4>Approval chain</h4>' + (q.status === 'Draft' || q.status === 'Rejected' ? (steps.length ? '<ul class="steps">' + steps.map((s) => '<li><b>' + s.role + '</b> · ' + esc(s.why) + '</li>').join('') + '</ul>' : '<p class="ok">Within policy: will auto-approve.</p>') :
        (q.approvals.length ? '<ul class="steps">' + q.approvals.map((a) => '<li>' + statusPill(a.status) + ' <b>' + a.role + '</b>' + (a.by ? ' · ' + esc(userById(a.by).name) + ' · ' + fmtTime(a.at) + (a.reason ? '<br><span class="muted">“' + esc(a.reason) + '”</span>' : '') : ' · ' + esc(a.why)) + '</li>').join('') + '</ul>' : '<p class="muted">Auto-approved within policy.</p>')) +
      '<div class="actions">' + actions.join('') + '</div></div>' +
      (q.contract ? contractDoc(q) : '') +
      '<div class="card"><h3>Audit trail</h3><ol class="audit">' + q.audit.slice().reverse().map((a) => '<li><span class="muted">' + fmtTime(a.at) + '</span> <b>' + esc(a.by === 'system' ? 'System' : userById(a.by).name) + '</b> · ' + esc(a.action) + '<br><span class="muted">' + esc(a.detail) + '</span></li>').join('') + '</ol></div>' +
      '</div></div>';
  }

  function contractDoc(q) {
    const pr = E.price(q), c = q.contract;
    return '<div class="card doc"><h3>Contract ' + c.number + '</h3><p class="muted small">Generated ' + fmtTime(c.issuedAt) + ' from approved quote ' + q.id + '</p>' +
      '<p><b>Parties:</b> Demo Fulfillment Co. and ' + esc(q.client) + ' (' + esc(D.entities[q.entity].label) + ').</p>' +
      '<p><b>Term:</b> ' + q.termMonths + ' months. <b>SLA:</b> ' + q.sla + ' (on-time ' + D.slaTiers[q.sla].onTime + ').</p>' +
      '<p><b>Fees:</b> ' + money(pr.monthlyNet, q) + ' per month at forecast volumes, plus ' + money(pr.oneTimeNet, q) + ' one-time; usage billed on actual WMS volumes at the rates in Schedule A.</p>' +
      '<p><b>Clauses:</b> SLA penalty ' + q.clauses.slaPenalty + '%; liability cap ' + q.clauses.liabilityMonths + ' months; termination notice ' + q.clauses.terminationDays + ' days; ' + (q.clauses.standardDPA ? 'standard DPA v3' : 'client data processing terms') + '.</p>' +
      (c.flags.length ? '<p class="note">Non-standard clauses were reviewed by Legal during approval.</p>' : '') + '</div>';
  }

  function viewApprovals() {
    const role = me().role;
    const items = S.quotes.filter((q) => q.status === 'Pending approval' && q.approvals.some((a) => a.status === 'Pending' && a.role === role));
    if (!['Deal desk', 'Finance', 'Legal'].includes(role)) return '<div class="head"><h2>Approvals</h2></div><div class="card"><p>You are signed in as <b>' + esc(me().name) + '</b> (' + esc(role) + '). Approvals are handled by Deal desk, Finance and Legal: switch user at the top right.</p></div>';
    if (!items.length) return '<div class="head"><h2>Approvals · ' + esc(role) + '</h2></div><div class="card"><p>Nothing waiting for ' + esc(role) + '.</p></div>';
    return '<div class="head"><h2>Approvals · ' + esc(role) + '</h2></div>' + items.map((q) => {
      const pr = E.price(q), a = q.approvals.find((x) => x.status === 'Pending' && x.role === role), flags = E.clauseFlags(q);
      const own = q.createdBy === S.user;
      const legalBlock = role === 'Legal' ? '<div class="flags">' + flags.map((f) => { const d = q.legal[f.id]; return '<div class="flag r-' + f.risk.toLowerCase() + '"><b>' + esc(f.name) + ' · ' + f.risk + '</b><span>' + esc(f.reason) + '</span><span class="muted small">Standard: ' + esc(f.standard) + '</span>' + (d ? '<span class="pill s-approved">' + esc(d) + '</span>' : '<span class="row"><button class="btn small" data-legal="' + q.id + '|' + f.id + '|Accepted">Accept clause</button><button class="btn small" data-legal="' + q.id + '|' + f.id + '|Revert to standard">Revert to standard</button></span>') + '</div>'; }).join('') + '<p class="muted small">AI review flags clauses against the library; a person decides on every flag.</p></div>' : '';
      const legalDone = role !== 'Legal' || flags.every((f) => q.legal[f.id]);
      return '<div class="card"><div class="head"><h3 class="click" data-open="' + q.id + '">' + q.id + ' · ' + esc(q.client) + '</h3>' + statusPill(q.status) + '</div>' +
        '<p><b>Why you:</b> ' + esc(a.why) + '</p><p class="muted">Owner ' + esc(userById(q.createdBy).name) + ' · monthly net ' + money(pr.monthlyNet, q) + ' · margin ' + E.pct(pr.margin) + ' · rep discount ' + E.pct(pr.manual) + ' · suggested ' + E.pct(q.suggestedAtSubmit || 0) + '</p>' + legalBlock +
        (own ? '<p class="errs">Separation of duties: you created this quote, so you cannot approve it.</p>' :
          '<div class="form"><label>Reason (logged)<input id="reason-' + q.id + '" placeholder="Why approve or reject?"></label></div><div class="actions"><button class="btn primary" data-approve="' + q.id + '|' + a.step + '"' + (legalDone ? '' : ' disabled title="Decide on every flagged clause first"') + '>Approve</button><button class="btn" data-reject="' + q.id + '|' + a.step + '">Reject</button></div>') + '</div>';
    }).join('');
  }

  function viewContracts() {
    const list = S.quotes.filter((q) => q.contract);
    return '<div class="head"><h2>Contracts & Legal</h2></div>' +
      '<div class="card"><h3>Clause library</h3><table><thead><tr><th>Clause</th><th>Standard position</th></tr></thead><tbody>' + D.clauses.map((c) => '<tr><td><b>' + esc(c.name) + '</b></td><td>' + esc(c.standard) + '</td></tr>').join('') + '</tbody></table></div>' +
      '<div class="card"><h3>Issued contracts</h3>' + (list.length ? '<table><thead><tr><th>Contract</th><th>Client</th><th>Term</th><th>Flags reviewed</th><th>Status</th></tr></thead><tbody>' + list.map((q) => '<tr class="click" data-open="' + q.id + '"><td><b>' + q.contract.number + '</b></td><td>' + esc(q.client) + '</td><td>' + q.termMonths + ' mo</td><td>' + (q.contract.flags.length ? q.contract.flags.map((f) => esc(f.name) + ': ' + esc(q.legal[f.id] || 'n/a')).join('<br>') : 'None') + '</td><td>' + statusPill(q.status) + '</td></tr>').join('') + '</tbody></table>' : '<p class="muted">No contracts yet. Approve a quote, then generate its contract.</p>') + '</div>';
  }

  function viewHandoff() {
    const list = S.quotes.filter((q) => q.handoff);
    if (!list.length) return '<div class="head"><h2>Handoff & revenue</h2></div><div class="card"><p class="muted">Close a quote as won to send it to WMS, billing and SAP.</p></div>';
    return '<div class="head"><h2>Handoff & revenue</h2></div>' + list.map((q) => {
      const pr = E.price(q), rr = E.revRec(q, pr), h = q.handoff;
      const total = rr.rows.reduce((s, r) => s + r.total, 0);
      return '<div class="card"><h3 class="click" data-open="' + q.id + '">' + q.id + ' · ' + esc(q.client) + '</h3><div class="grid3">' +
        '<div class="hand"><b>WMS client setup</b><span class="pill s-approved">' + h.wms.mode + '</span><p>' + esc(h.wms.response) + '</p><details><summary>Payload</summary><pre>' + esc(JSON.stringify(h.wms.payload, null, 2)) + '</pre></details></div>' +
        '<div class="hand"><b>Billing rate sync</b><span class="pill ' + (h.billing.status === 'Completed' ? 's-approved' : 's-pending-approval') + '">' + h.billing.mode + ' · ' + h.billing.status + '</span><p>Job ' + esc(h.billing.job) + ' queued ' + fmtTime(h.billing.queuedAt) + (h.billing.doneAt ? '; completed ' + fmtTime(h.billing.doneAt) : '') + '.</p>' + (h.billing.status !== 'Completed' ? '<button class="btn small" data-act="refresh">Refresh status</button>' : '') + '</div>' +
        '<div class="hand"><b>Revenue schedule to SAP</b><span class="pill s-approved">' + h.sap.mode + '</span><p>' + esc(h.sap.response) + ' · ' + h.sap.document + '</p></div></div>' +
        '<h4>Revenue recognition (ASC 606 / IFRS 15, simplified)</h4><p class="muted small">' + esc(rr.note) + '</p><div class="scroll"><table><thead><tr><th>Month</th><th class="num">Fixed + onboarding</th><th class="num">Usage (forecast)</th><th class="num">Total</th></tr></thead><tbody>' +
        rr.rows.slice(0, 6).map((r) => '<tr><td>' + r.month + '</td><td class="num">' + money(r.fixed, q) + '</td><td class="num">' + money(r.usage, q) + '</td><td class="num">' + money(r.total, q) + '</td></tr>').join('') +
        (rr.rows.length > 6 ? '<tr><td colspan="4" class="muted">… ' + (rr.rows.length - 6) + ' more months</td></tr>' : '') + '<tr class="tot"><td>Total</td><td></td><td></td><td class="num">' + money(total, q) + '</td></tr></tbody></table></div></div>';
    }).join('');
  }

  function viewRecon() {
    const list = S.quotes.filter((q) => q.status === 'Closed Won');
    if (!list.length) return '<div class="head"><h2>Usage reconciliation</h2></div><div class="card"><p class="muted">No active contracts yet.</p></div>';
    const isFin = me().role === 'Finance';
    return '<div class="head"><h2>Usage reconciliation</h2></div><p class="muted">Billed volumes (contract forecast) against actual WMS volumes (simulated). Variances above ' + E.pct(D.policy.reconTolerance, 0) + ' hold the invoice for Finance.</p>' + list.map((q) => {
      const pr = E.price(q), rows = E.reconcile(q, pr, 3);
      const ex = rows.filter((r) => r.exception);
      const open = ex.filter((r) => !q.recon[r.key]);
      return '<div class="card"><div class="head"><h3 class="click" data-open="' + q.id + '">' + q.id + ' · ' + esc(q.client) + '</h3><span class="pill ' + (open.length ? 's-rejected' : 's-approved') + '">' + (open.length ? open.length + ' open exception' + (open.length > 1 ? 's' : '') : 'Clear') + '</span></div><div class="scroll"><table><thead><tr><th>Month</th><th>Service</th><th class="num">Billed</th><th class="num">Actual (WMS)</th><th class="num">Variance</th><th class="num">Adjustment</th><th></th></tr></thead><tbody>' +
        rows.map((r) => '<tr class="' + (r.exception ? 'exc' : '') + '"><td>' + r.month + '</td><td>' + esc(r.name) + '</td><td class="num">' + r.billedQty.toLocaleString('en-US') + '</td><td class="num">' + r.actualQty.toLocaleString('en-US') + '</td><td class="num">' + (r.variance >= 0 ? '+' : '') + E.pct(r.variance) + '</td><td class="num">' + money(r.amount, q) + '</td><td>' + (r.exception ? (q.recon[r.key] ? '<span class="pill s-approved">' + esc(q.recon[r.key]) + '</span>' : (isFin ? '<button class="btn small" data-recon="' + q.id + '|' + r.key + '">Approve adjustment</button>' : '<span class="muted small">Finance to review</span>')) : '') + '</td></tr>').join('') + '</tbody></table></div></div>';
    }).join('');
  }

  function analyticsRecords() {
    const fromQuotes = S.quotes.filter((q) => q.submittedAt).map((q) => {
      const pr = E.price(q); const mix = {};
      pr.lines.forEach((l) => { if (l.billing !== 'one-time' && pr.monthlyList) mix[l.code] = (mix[l.code] || 0) + l.list / pr.monthlyList; });
      return { id: q.id, client: q.client, rep: q.createdBy, discount: pr.manual, suggested: q.suggestedAtSubmit || 0, won: q.outcome === 'won' ? true : q.outcome === 'lost' ? false : null, listMonthlyUSD: pr.monthlyList, mix, submitted: q.submittedAt, approvalHours: q.approvedAt ? (q.approvedAt - q.submittedAt) / 36e5 : null, currency: cur(q), live: true };
    });
    const f = S.filters, cutoff = now() - 90 * 864e5;
    return D.history.concat(fromQuotes).filter((r) => (f.rep === 'all' || r.rep === f.rep) && (f.currency === 'all' || r.currency === f.currency) && (f.period === 'all' || r.submitted >= cutoff));
  }

  function viewAnalytics() {
    const recs = analyticsRecords(), a = E.analytics(recs), f = S.filters;
    const sel = (name, opts) => '<select data-filter="' + name + '">' + opts.map(([v, l]) => '<option value="' + v + '"' + (f[name] === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select>';
    const tile = (id, label, value, sub) => '<button class="tile' + (S.drill === id ? ' on' : '') + '" data-drill="' + id + '"><span class="muted">' + label + '</span><b>' + value + '</b><span class="muted small">' + sub + '</span></button>';
    const maxM = Math.max(0.01, ...a.marginBySvc.map((x) => x.margin));
    let drill = '';
    if (S.drill) {
      let rows = recs;
      if (S.drill === 'win') rows = recs.filter((r) => r.won != null);
      if (S.drill === 'leak') rows = recs.filter((r) => r.discount > r.suggested).sort((x, y) => (y.discount - y.suggested) - (x.discount - x.suggested));
      if (S.drill === 'cycle') rows = recs.filter((r) => r.approvalHours != null).sort((x, y) => y.approvalHours - x.approvalHours);
      drill = '<div class="card"><h3>Underlying quotes (' + rows.length + ')</h3><div class="scroll"><table><thead><tr><th>Quote</th><th>Client</th><th>Rep</th><th class="num">List / month (USD)</th><th class="num">Discount</th><th class="num">Suggested</th><th class="num">Approval hrs</th><th>Outcome</th></tr></thead><tbody>' +
        rows.slice(0, 40).map((r) => '<tr' + (r.live ? ' class="click" data-open="' + r.id + '"' : '') + '><td>' + esc(r.id) + '</td><td>' + esc(r.client) + '</td><td>' + esc(userById(r.rep).name) + '</td><td class="num">' + Math.round(r.listMonthlyUSD).toLocaleString('en-US') + '</td><td class="num">' + E.pct(r.discount) + '</td><td class="num">' + E.pct(r.suggested) + '</td><td class="num">' + (r.approvalHours != null ? r.approvalHours.toFixed(1) : '–') + '</td><td>' + (r.won === true ? 'Won' : r.won === false ? 'Lost' : 'Open') + '</td></tr>').join('') + '</tbody></table></div></div>';
    }
    return '<div class="head"><h2>Quote analytics</h2><div class="row">' + sel('period', [['all', 'All time'], ['90', 'Last 90 days']]) + sel('rep', [['all', 'All reps'], ['ana', 'Ana Putri'], ['sam', 'Sam Rao']]) + sel('currency', [['all', 'All currencies'], ['USD', 'USD'], ['INR', 'INR'], ['IDR', 'IDR']]) + '</div></div>' +
      '<p class="muted">Demo history (36 fictional quotes) plus quotes submitted in this browser. Click a tile to see the quotes behind it.</p>' +
      '<div class="tiles">' + tile('win', 'Win rate', E.pct(a.winRate, 0), a.won + ' won of ' + a.closed + ' closed') + tile('leak', 'Discount leakage', E.pct(a.leakPct, 1), '$' + Math.round(a.leakUSD).toLocaleString('en-US') + ' / month above suggestion · ' + a.leakCount + ' quotes') + tile('cycle', 'Approval cycle time', a.cycle.toFixed(1) + ' h', 'average, submission to final approval') + tile('all', 'Quotes', String(a.count), 'in this view') + '</div>' +
      '<div class="card"><h3>Margin by service</h3>' + a.marginBySvc.map((x) => '<div class="bar"><span>' + esc(x.name) + '</span><i style="width:' + (x.margin / maxM * 100).toFixed(1) + '%"></i><b>' + E.pct(x.margin) + '</b></div>').join('') + '</div>' + drill;
  }

  function viewCatalog() {
    return '<div class="head"><h2>Catalog & rules</h2></div><div class="grid2"><div>' +
      '<div class="card"><h3>Price book (USD)</h3><table><thead><tr><th>Code</th><th>Service</th><th>Unit</th><th class="num">List</th><th class="num">Cost</th></tr></thead><tbody>' + D.products.map((p) => '<tr><td>' + p.code + '</td><td>' + esc(p.name) + '</td><td>' + esc(p.unit || p.billing) + '</td><td class="num">$' + p.price.toLocaleString('en-US', { minimumFractionDigits: 2 }) + '</td><td class="num">$' + p.cost.toLocaleString('en-US', { minimumFractionDigits: 2 }) + '</td></tr>').join('') + '</tbody></table><p class="muted small">Quotes convert at demo rates: 1 USD = 84 INR = 16,300 IDR, locked at approval.</p></div>' +
      '<div class="card"><h3>Bundles</h3><ul>' + D.bundles.map((b) => '<li><b>' + esc(b.name) + '</b>: ' + b.items.join(' + ') + ' · −' + Math.round(b.discount * 100) + '%</li>').join('') + '</ul></div>' +
      '<div class="card"><h3>Product rules</h3><ul><li>Fresh or chilled SKUs need Chilled storage.</li><li>Dark-store fulfillment needs Inbound handling.</li><li>Every service needs a quantity above zero.</li></ul></div>' +
      '</div><div>' +
      '<div class="card"><h3>Volume tiers (order lines)</h3><ul>' + D.volumeTiers.map((t) => '<li>' + t.min.toLocaleString('en-US') + '+ orders / month: −' + Math.round(t.discount * 100) + '%</li>').join('') + '</ul><p class="muted small">Commitment bonus: −2% when monthly list value is $50,000 or more.</p></div>' +
      '<div class="card"><h3>SLA tiers</h3><ul>' + Object.entries(D.slaTiers).map(([k, v]) => '<li><b>' + k + '</b>: +' + Math.round(v.uplift * 100) + '% on usage, ' + v.onTime + ' on-time, standard penalty ' + v.penalty + '%</li>').join('') + '</ul></div>' +
      '<div class="card"><h3>Approval policy</h3><ul><li>Rep discount above 10% → Deal desk</li><li>Above 20%, or margin below 25% → Finance</li><li>Any non-standard clause → Legal</li><li>Approvers cannot approve their own quotes</li><li>Any edit after approval returns the quote to Draft</li></ul></div>' +
      '<div class="card"><h3>Tax (demo rates)</h3><ul>' + Object.values(D.entities).map((e) => '<li>' + esc(e.label) + ': ' + esc(e.taxName) + ' ' + Math.round(e.taxRate * 100) + '%</li>').join('') + '</ul></div>' +
      '</div></div>';
  }

  // ---------- Events ----------
  document.addEventListener('click', (ev) => {
    const t = ev.target.closest('button, tr[data-open], h3[data-open]');
    if (!t) return;
    const d = t.dataset;
    if (d.view) { S.view = d.view; S.selected = null; return render(); }
    if (d.open) { S.selected = d.open; return render(); }
    const q = S.selected && getQ(S.selected);
    if (d.act === 'new') { const id = 'Q-' + S.seq++; S.quotes.push(blankQuote(id, S.user)); S.selected = id; return render(); }
    if (d.act === 'back') { S.selected = null; S.view = 'quotes'; return render(); }
    if (d.act === 'refresh') return render();
    if (d.act === 'save' && q) { log(q, S.user, 'Saved', 'Draft saved.'); return render(); }
    if (d.act === 'addline' && q) { touch(q); q.lines.push({ code: 'VAS-KIT', qty: 10000 }); return render(); }
    if (d.del != null && q) { touch(q); q.lines.splice(Number(d.del), 1); return render(); }
    if (d.act === 'applysug' && q) { touch(q); const sug = E.suggestDiscount(q, E.price(q)); q.manualDiscount = E.round2((sug.best.from + sug.best.to) / 2); log(q, S.user, 'Applied suggestion', 'Rep discount set to ' + E.pct(q.manualDiscount) + '.'); return render(); }
    if (d.act === 'submit' && q) { if (E.validate(q).length) return render(); submit(q, S.user); return render(); }
    if (d.act === 'contract' && q) { issueContract(q, S.user); return render(); }
    if (d.act === 'won' && q) { closeWon(q, S.user); render(); setTimeout(render, 4300); return; }
    if (d.act === 'lost' && q) { q.status = 'Closed Lost'; q.outcome = 'lost'; q.closedAt = now(); log(q, S.user, 'Closed Lost', 'Deal marked lost.'); return render(); }
    if (d.approve || d.reject) {
      const [id, step] = (d.approve || d.reject).split('|'); const qq = getQ(id);
      if (qq.createdBy === S.user) return render();
      const reason = ($('#reason-' + id) || {}).value || '';
      if (d.reject && !reason.trim()) { alertMsg('Add a reason before rejecting.'); return; }
      decide(qq, step, !!d.approve, reason.trim()); return render();
    }
    if (d.legal) { const [id, cid, dec] = d.legal.split('|'); const qq = getQ(id); qq.legal[cid] = dec; log(qq, S.user, 'Clause decision', E.clauseFlags(qq).find((f) => f.id === cid).name + ': ' + dec + '.'); return render(); }
    if (d.recon) { const [id, key] = d.recon.split('|'); const qq = getQ(id); qq.recon[key] = 'Adjusted by ' + me().name; log(qq, S.user, 'Invoice adjustment approved', key); return render(); }
    if (d.drill) { S.drill = S.drill === d.drill ? null : d.drill; return render(); }
    if (d.act === 'reset') { S = seed(); return render(); }
  });
  function alertMsg(m) { const n = $('#toast'); n.textContent = m; n.hidden = false; setTimeout(() => { n.hidden = true; }, 2600); }

  document.addEventListener('change', (ev) => {
    const el = ev.target, d = el.dataset;
    if (el.id === 'user') { S.user = el.value; return render(); }
    if (d.filter) { S.filters[d.filter] = el.value; return render(); }
    const q = S.selected && getQ(S.selected);
    if (!q || !editable(q)) return;
    if (d.q) { touch(q); q[d.q] = el.type === 'checkbox' ? el.checked : d.q === 'manualDiscount' ? Math.max(0, Math.min(50, Number(el.value) || 0)) / 100 : d.q === 'termMonths' ? Number(el.value) : el.value; return render(); }
    if (d.c) { touch(q); q.clauses[d.c] = el.type === 'checkbox' ? el.checked : Number(el.value); return render(); }
    if (d.line != null) { touch(q); const l = q.lines[Number(d.line)]; l[d.f] = d.f === 'qty' ? Math.max(0, Math.round(Number(el.value) || 0)) : el.value; return render(); }
  });

  $('#reset').addEventListener('click', () => { S = seed(); render(); });
  try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
  if (!S || !S.quotes) S = seed();
  render();
})();
