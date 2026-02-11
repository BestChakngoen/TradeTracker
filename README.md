# TradeTracker — Static deploy (GitHub Pages)

This folder contains the static frontend for TradeTracker. To publish via GitHub Pages (free):

1. Create a new repository on GitHub.
2. From this project folder, run:

```powershell
git init
git add .
git commit -m "Initial deploy"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo>.git
git push -u origin main
```

3. On GitHub: Settings → Pages → Branch: `main` / folder: `/ (root)` → Save.
4. After a minute the site will be available at `https://<your-username>.github.io/<repo>/`.

Notes:
- `index.html` redirects to `TrackerView.html` (the main app file).
- If you prefer the app at the repo root without a redirect, rename `TrackerView.html` to `index.html` before pushing.
- If you want automatic deploys from GitHub, you can enable Actions or use Netlify/Vercel instead.
