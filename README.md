# QuoteFlow · CPQ-to-Contract Prototype

**A working product prototype of a Configure-Price-Quote (CPQ) to contract flow for e-commerce fulfillment services, designed and built by [Rajdip Sengupta](https://www.linkedin.com/in/rajdip-sengupta-a1664182), Senior Product Manager.**

🔗 **Live demo:** `https://<your-github-username>.github.io/quoteflow-cpq/` · ⏱ 5-minute walkthrough below

> Personal prototype. All products, prices, clients, exchange rates and tax rates are fictional, and the WMS, billing and SAP integrations are simulated. Not affiliated with Salesforce.

---

## The problem

When an e-commerce company sells warehousing and fulfillment services to enterprise brands, every deal mixes usage-based fees, fixed fees, volume discounts, SLA tiers and contract terms. In most teams:

- **Pricing lives in spreadsheets,** so the same service is priced differently from deal to deal.
- **Discount approvals happen over email,** with no audit trail: a SOX and financial-controls risk.
- **Legal re-types terms into contracts,** creating mismatches between quote, contract and invoice.
- **Operations re-enters rates by hand** after signature, delaying client go-live.

QuoteFlow shows how a Salesforce CPQ style flow can take a deal from quote to approved contract to live billing, with controls built in.

## What I built

| Capability | How it works |
|---|---|
| **Configurable pricing** | Usage-based services (per order, per pallet-day, per inbound unit), fixed fees, bundles, SLA tiers, volume tiers and a commitment bonus, with live margin against a 25% floor |
| **Product rules** | Invalid configurations are blocked, e.g. fresh SKUs without chilled storage |
| **Multi-currency and tax** | USD, INR and IDR quotes with country tax; exchange rates locked at approval |
| **AI-suggested discount** | Suggests a discount band from historical win rates and margin; it never approves on its own |
| **Approval chain with SOX controls** | Deal desk, Finance and Legal steps by policy; no self-approval; any edit after approval forces re-approval; full audit trail |
| **Contract and clause review** | Contract generated from approved terms; non-standard clauses flagged against a clause library and decided by Legal |
| **Downstream handoff** | Closed Won sends WMS setup (synchronous), billing rates (asynchronous) and an ASC 606 / IFRS 15 revenue schedule to SAP (mock) |
| **Usage reconciliation** | Billed vs actual warehouse volumes; variances above 3% hold the invoice for Finance |
| **Quote analytics** | Win rate, discount leakage, approval cycle time and margin by service, with drill-down to quotes |

## Product decisions I made

1. **AI suggests, people decide.** The discount model recommends a band, but any discount above threshold still goes through human approval, so automation never weakens financial controls.
2. **Controls by design, not by process.** Separation of duties, locked approved quotes and an audit trail on every step mean the evidence an auditor needs is created as the work happens.
3. **One source of truth from quote to cash.** Contract terms, WMS rates, billing and revenue schedules all come from the same approved quote, removing re-typing and mismatches.
4. **Synchronous where it must be, asynchronous where it can be.** WMS client setup confirms immediately; bulk billing rate sync runs in the background, trading speed for scale and cost.
5. **Measure the commercial engine.** Discount leakage and approval cycle time show where pricing policy or approval thresholds need tuning.

## Try it in 5 minutes

1. As **Ana Putri (Sales rep)**, click **New quote** and tick *fresh or chilled SKUs*. The product rule blocks the quote until you add Chilled storage.
2. Set a **22% discount** and a **45-day termination notice**. The approval chain now needs Deal desk, Finance and Legal.
3. **Submit**, then switch user (top right) to **Dev** (Deal desk), **Fatima** (Finance) and **Leo** (Legal) to approve. Legal must decide on each flagged clause first.
4. Back as Ana, **generate the contract**, mark it **Closed Won**, and open **Handoff & revenue** to see the WMS payload, the billing job and the revenue schedule.
5. As Fatima, open **Usage reconciliation** and approve an invoice adjustment.
6. Open **Analytics** and click any tile to see the quotes behind it.

**Reset demo** (top right) starts over. Your changes stay only in your browser.

## Skills this project demonstrates

**Product management:** problem framing, PRD writing, prioritization, scope control, success metrics
**Quote-to-cash domain:** CPQ, pricing and discount policy, approval workflows, contract lifecycle, revenue recognition (ASC 606 / IFRS 15), billing reconciliation
**Financial controls:** SOX-style separation of duties, audit trails, approval evidence
**Platform and integration design:** API handoffs, synchronous vs asynchronous trade-offs, multi-currency and tax
**Responsible AI:** human-in-the-loop decisions, transparent suggestions
**AI-native building:** prototyped end to end with Claude Code

## Built with

Plain HTML, CSS and JavaScript, with no backend and no build step, hosted free on GitHub Pages.

| File | Purpose |
|---|---|
| `index.html` | Page shell |
| `styles.css` | Styles with light and dark themes |
| `data.js` | Fictional catalog, policies, clause library and demo history |
| `engine.js` | Pricing, rules, approvals, discount model, revenue schedule, reconciliation and analytics |
| `app.js` | User interface and workflow |

Hosting steps are in [HOSTING.md](HOSTING.md).

## About me

I'm a Senior Product Manager with 10+ years across product management, technology consulting and software engineering. I build enterprise platforms, data infrastructure and AI agents for supply chain and e-commerce, and I've led SOX compliance programs across Flipkart, Walmart and EY.

**Let's talk:** [LinkedIn](https://www.linkedin.com/in/rajdip-sengupta-a1664182) · rajdip.sengupta17@iimranchi.ac.in

## License

MIT. See [LICENSE](LICENSE).
