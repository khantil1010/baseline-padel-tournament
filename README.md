# Baseline Padel Tournament Manager

## Requirements
- Node.js 18.18+ (Node 20+ recommended)
- VS Code
- A GitHub account for the easiest Vercel deployment

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Deploy to Vercel

1. Create a GitHub repository named `baseline-padel-tournament`.
2. Upload all files in this folder to that repository.
3. Go to https://vercel.com and sign in with GitHub.
4. Click **Add New Project**.
5. Import the GitHub repository.
6. Keep the detected Next.js settings and click **Deploy**.

## Notes
- This starter stores data in the browser's localStorage.
- It is suitable for one device/browser during the tournament.
- For multi-device shared scoring, add a database/authentication layer such as Supabase in the next version.
- Live scoring uses + GAME taps and automatically completes a set at 6 games with a 2-game lead.
- Tie-break scoring and the best-of-3 grand-final series should be added in the next iteration.
