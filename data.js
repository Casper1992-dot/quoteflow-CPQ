/* QuoteFlow demo data. Every product, price, client and rate here is fictional. */
window.QF_DATA = (function () {
  const users = [
    { id: 'ana', name: 'Ana Putri', role: 'Sales rep' },
    { id: 'sam', name: 'Sam Rao', role: 'Sales rep' },
    { id: 'dev', name: 'Dev Menon', role: 'Deal desk' },
    { id: 'fatima', name: 'Fatima Noor', role: 'Finance' },
    { id: 'leo', name: 'Leo Hartono', role: 'Legal' },
  ];

  // Demo exchange rates (units per 1 USD) and demo tax rates. Not real rates.
  const currencies = {
    USD: { symbol: '$', perUSD: 1, decimals: 2 },
    INR: { symbol: '₹', perUSD: 84, decimals: 0 },
    IDR: { symbol: 'Rp', perUSD: 16300, decimals: 0 },
  };
  const entities = {
    US: { label: 'United States entity', currency: 'USD', taxName: 'Sales tax (demo)', taxRate: 0 },
    IN: { label: 'India entity', currency: 'INR', taxName: 'GST (demo)', taxRate: 0.18 },
    ID: { label: 'Indonesia entity', currency: 'IDR', taxName: 'VAT (demo)', taxRate: 0.11 },
  };

  // Price book in USD. type: usage (priced per unit per month) or fixed (one-time or monthly).
  const products = [
    { code: 'FUL-ORD', name: 'Order fulfillment (pick, pack, ship)', type: 'usage', unit: 'order', price: 0.85, cost: 0.45, volumeTiered: true },
    { code: 'DS-FUL', name: 'Dark-store fulfillment', type: 'usage', unit: 'order', price: 1.10, cost: 0.58, volumeTiered: true },
    { code: 'STO-PAL', name: 'Ambient storage', type: 'usage', unit: 'pallet-day', price: 0.60, cost: 0.32 },
    { code: 'CHL-STO', name: 'Chilled storage', type: 'usage', unit: 'pallet-day', price: 1.40, cost: 0.78 },
    { code: 'INB-UNIT', name: 'Inbound handling', type: 'usage', unit: 'inbound unit', price: 0.05, cost: 0.025 },
    { code: 'VAS-KIT', name: 'Kitting and value-added services', type: 'usage', unit: 'unit', price: 0.20, cost: 0.10 },
    { code: 'ONB', name: 'Client onboarding', type: 'fixed', billing: 'one-time', price: 5000, cost: 2500 },
    { code: 'DED-SPACE', name: 'Dedicated warehouse space', type: 'fixed', billing: 'monthly', price: 8000, cost: 4800 },
  ];

  const bundles = [
    { code: 'PKG-DARK', name: 'Dark-store fulfillment package', items: ['DS-FUL', 'CHL-STO', 'INB-UNIT'], discount: 0.05 },
    { code: 'PKG-STD', name: 'Standard e-commerce package', items: ['FUL-ORD', 'STO-PAL', 'INB-UNIT', 'ONB'], discount: 0.03 },
  ];

  const slaTiers = {
    Standard: { uplift: 0, onTime: '95%', penalty: 2 },
    Premium: { uplift: 0.08, onTime: '97%', penalty: 5 },
    Platinum: { uplift: 0.15, onTime: '99%', penalty: 8 },
  };

  // Volume discount on per-order lines, by monthly orders.
  const volumeTiers = [
    { min: 0, discount: 0 },
    { min: 50000, discount: 0.05 },
    { min: 200000, discount: 0.08 },
    { min: 500000, discount: 0.12 },
  ];

  const policy = {
    marginFloor: 0.25,
    dealDeskAbove: 0.10,
    financeAbove: 0.20,
    commitmentBonus: { minMonthlyUSD: 50000, extra: 0.02 },
    reconTolerance: 0.03,
  };

  // Clause library: Legal's standard positions and approved fallbacks.
  const clauses = [
    { id: 'sla', name: 'SLA penalty', standard: 'Service credit capped at the SLA tier penalty (2–8% of monthly fees).', check: (q, slaTiers) => q.clauses.slaPenalty > slaTiers[q.sla].penalty ? { risk: 'High', reason: 'Penalty of ' + q.clauses.slaPenalty + '% exceeds the ' + q.sla + ' tier standard of ' + slaTiers[q.sla].penalty + '%.' } : null },
    { id: 'liability', name: 'Liability cap', standard: 'Liability capped at 12 months of fees.', check: (q) => q.clauses.liabilityMonths > 12 ? { risk: q.clauses.liabilityMonths > 24 ? 'High' : 'Medium', reason: 'Cap of ' + q.clauses.liabilityMonths + ' months of fees is above the 12-month standard.' } : null },
    { id: 'termination', name: 'Termination for convenience', standard: '90 days written notice.', check: (q) => q.clauses.terminationDays < 90 ? { risk: q.clauses.terminationDays < 30 ? 'High' : 'Medium', reason: 'Notice of ' + q.clauses.terminationDays + ' days is shorter than the 90-day standard.' } : null },
    { id: 'data', name: 'Data protection', standard: 'Standard data processing addendum (DPA v3).', check: (q) => !q.clauses.standardDPA ? { risk: 'Medium', reason: 'Client asked for its own data processing terms instead of the standard DPA.' } : null },
  ];

  // Seeded history for analytics and the discount model. Deterministic.
  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  const clientsSeed = ['Northwind Grocers', 'Bluebay Apparel', 'Kopi Kita', 'Lumen Electronics', 'Pantry Plus', 'Urban Pets', 'Sari Beauty', 'Tera Home', 'Volt Mobile', 'Fresh Fields', 'Kidsy Toys', 'Arunika Foods', 'Metro Books', 'Peak Sports', 'Nusa Spices'];
  function history() {
    const r = rng(42), out = [];
    const t0 = Date.UTC(2026, 0, 6);
    for (let i = 0; i < 36; i++) {
      const rep = r() < 0.55 ? 'ana' : 'sam';
      const discount = Math.round((r() * 0.26) * 100) / 100;
      const size = r() < 0.4 ? 'small' : r() < 0.7 ? 'medium' : 'large';
      const suggested = size === 'large' ? 0.10 : size === 'medium' ? 0.07 : 0.04;
      const pWin = Math.min(0.85, 0.35 + discount * 1.6 - (size === 'large' ? 0.05 : 0) + (r() - 0.5) * 0.2);
      const won = r() < pWin;
      const listMonthlyUSD = size === 'large' ? 120000 + r() * 80000 : size === 'medium' ? 40000 + r() * 40000 : 8000 + r() * 20000;
      const mix = { 'FUL-ORD': 0.30 + r() * 0.2, 'DS-FUL': r() * 0.2, 'STO-PAL': 0.15 + r() * 0.1, 'CHL-STO': r() * 0.1, 'INB-UNIT': 0.05, 'VAS-KIT': r() * 0.05 };
      const submitted = t0 + i * 6.5 * 86400000 + Math.floor(r() * 86400000);
      const approvalHours = discount > 0.20 ? 30 + r() * 40 : discount > 0.10 ? 10 + r() * 20 : 1 + r() * 4;
      out.push({ id: 'H-' + (1001 + i), client: clientsSeed[i % clientsSeed.length], rep, size, discount, suggested, won, listMonthlyUSD: Math.round(listMonthlyUSD), mix, submitted, approvalHours: Math.round(approvalHours * 10) / 10, currency: ['USD', 'INR', 'IDR'][Math.floor(r() * 3)] });
    }
    return out;
  }

  return { users, currencies, entities, products, bundles, slaTiers, volumeTiers, policy, clauses, history: history() };
})();
