# QuoteFlow: CPQ-to-contract prototype for e-commerce fulfillment

QuoteFlow is a working product prototype that shows how a Salesforce CPQ style flow could quote, approve, contract and hand off warehousing and fulfillment deals to enterprise brands and sellers.

> Prototype only. Every product, price, client, exchange rate and tax rate is fictional. Integrations to WMS, billing and SAP are simulated. Not affiliated with or endorsed by Salesforce.

**Live demo:** `https://<your-github-username>.github.io/quoteflow-cpq/`

## What it does

| Area | What you can try |
|---|---|
| Catalog and pricing | Usage-based services (per order, per pallet-day, per inbound unit), fixed fees, bundles, SLA tiers, volume tiers and a commitment bonus |
| Product rules | Fresh SKUs require chilled storage; dark-store fulfillment requires inbound handling |
| Multi-currency and tax | USD, INR and IDR price conversion, demo tax per billing entity, exchange rate locked at approval |
| AI-suggested discount | A simulated model on demo history suggests a discount band by win rate and margin; it never approves anything |
| Approvals and controls | Deal desk above 10%, Finance above 20% or below a 25% margin floor, Legal for non-standard clauses; separation of duties; edits after approval force re-approval; full audit trail |
| Contracts and Legal | Contract generated from approved terms; clause library; flagged clauses must be accepted or reverted by Legal |
| Handoff and revenue | Closed Won sends WMS setup (synchronous), billing rates (asynchronous) and an ASC 606 / IFRS 15 revenue schedule to a mock SAP endpoint |
| Usage reconciliation | Billed volumes compared with simulated WMS actuals; variances above 3% become Finance exceptions |
| Quote analytics | Win rate, discount leakage, approval cycle time and margin by service, with drill-down to quotes |

## Try this demo path (5 minutes)

1. As **Ana Putri (Sales rep)**, click **New quote**. Tick *fresh or chilled SKUs* and see the product rule block the quote until you add Chilled storage.
2. Set a 22% discount and a 45-day termination notice. The approval chain now shows Deal desk, Finance and Legal.
3. Submit, then switch to **Dev Menon (Deal desk)**, **Fatima Noor (Finance)** and **Leo Hartono (Legal)** to approve. Legal must decide on each flagged clause first.
4. Back as Ana: generate the contract, mark it **Closed Won**, and open **Handoff & revenue** to see the WMS payload, the async billing job and the revenue schedule.
5. As Fatima, open **Usage reconciliation** and approve an invoice adjustment.
6. Open **Analytics** and click a tile to see the quotes behind it.

Use **Reset demo** at the top right to start again. Data is kept only in your browser.

## Tech

Static HTML, CSS and vanilla JavaScript. No build step, no backend, no external services except Google Fonts.

| File | Purpose |
|---|---|
| `index.html` | Page shell |
| `styles.css` | Styles, light and dark themes |
| `data.js` | Fictional catalog, policies, clause library and seeded history |
| `engine.js` | Pricing, rules, approvals, discount model, revenue schedule, reconciliation and analytics (pure functions) |
| `app.js` | UI and workflow state |

## Product documentation

The one-page PRD behind this prototype: *PRD: Salesforce CPQ for E-commerce Fulfillment Services* (link it here once you share it).

---

## Hosting plan: GitHub Pages (free)

### 1. Create the repository
1. Sign in to GitHub with a **personal account** (not a work account).
2. Click **New repository**, name it `quoteflow-cpq`, set it to **Public**, tick **Add a README** off (this folder already has one), and create it.

### 2. Upload the files
**Option A, browser (no tools needed):** on the repository page click **Add file → Upload files**, drag in every file from this folder (`index.html`, `styles.css`, `data.js`, `engine.js`, `app.js`, `README.md`, `.nojekyll`, `LICENSE`), then **Commit changes**.

**Option B, command line:**
```bash
cd quoteflow-cpq
git init
git add .
git commit -m "QuoteFlow CPQ prototype"
git branch -M main
git remote add origin https://github.com/<your-github-username>/quoteflow-cpq.git
git push -u origin main
```

### 3. Turn on GitHub Pages
1. Go to **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**, choose **main** and **/(root)**, then **Save**.
3. Wait 1 to 3 minutes. The site is live at `https://<your-github-username>.github.io/quoteflow-cpq/`.

### 4. Check it
- Open the link on a laptop and a phone.
- Run the demo path above end to end.
- Click **Reset demo** and confirm the seeded quotes come back.

### 5. Make it recruiter-ready
1. Replace `<your-github-username>` in this README with your username.
2. Add 2 or 3 screenshots (quote builder, approvals, analytics) to a `docs/` folder and show them in this README.
3. Pin the repository on your GitHub profile.
4. Add the live link to your resume project line, your portfolio, and LinkedIn **Featured**.
5. Optional: record a 60-second screen walkthrough and link it here.

### 6. Updating later
Edit a file on GitHub (pencil icon) or push a new commit; Pages redeploys in about a minute.

## License

MIT. See `LICENSE`.
