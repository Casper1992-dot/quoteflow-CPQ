# Hosting QuoteFlow on GitHub Pages (free)

## 1. Create the repository
1. Sign in to GitHub with a **personal account** (not a work account).
2. Click **New repository**, name it `quoteflow-cpq`, set it to **Public**, leave "Add a README" unticked, and create it.

## 2. Upload the files
**Browser (no tools needed):** on the repository page click **Add file → Upload files**, drag in `index.html`, `styles.css`, `data.js`, `engine.js`, `app.js`, `README.md`, `HOSTING.md`, `LICENSE` and `.nojekyll`, then **Commit changes**. (`.nojekyll` is hidden on a Mac; the site works without it.)

**Command line:**
```bash
cd quoteflow-cpq
git init
git add .
git commit -m "QuoteFlow CPQ prototype"
git branch -M main
git remote add origin https://github.com/Casper1992-dot/quoteflow-CPQ.git
git push -u origin main
```

## 3. Turn on GitHub Pages
1. Go to **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**, choose **main** and **/(root)**, then **Save**.
3. Wait 1 to 3 minutes. The site is live at `https://casper1992-dot.github.io/quoteflow-CPQ/`.

## 4. Check it
- Open the link on a laptop and a phone.
- Run the 5-minute walkthrough from the README.
- Click **Reset demo** and confirm the demo quotes come back.

## 5. Make it recruiter-ready
1. Replace `<your-github-username>` in README.md with your username.
2. Add 2 or 3 screenshots (quote builder, approvals, analytics) to a `docs/` folder and show them in the README.
3. In the repository's **About** box, add the description, website link and topics.
4. Pin the repository on your GitHub profile.
5. Add the live link to your resume, portfolio and LinkedIn **Featured**.

## 6. Updating later
Edit a file on GitHub (pencil icon) or push a new commit; Pages redeploys in about a minute.
