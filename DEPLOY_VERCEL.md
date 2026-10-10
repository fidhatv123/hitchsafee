# HitchSafe — Vercel Deployment Guide

HitchSafe is fully pre-configured for **1-click or CLI deployment on Vercel** as a live public web application.

---

## Architecture on Vercel

* **Frontend**: React + Tailwind + Leaflet OpenStreetMap built via Vite into static assets.
* **Backend API**: Python Serverless Function (`api/index.py`) wrapping the FastAPI backend with Scikit-learn wait-time prediction, incident routing, and dual emergency escalation.
* **Routing**: `vercel.json` routes `/api/*` to the Python serverless function and all other paths to the React frontend with client-side SPA routing (`/track/:token`).

---

## Option 1: Deploy with Vercel CLI (Recommended & Fastest)

If you have Node.js installed, open a terminal in the project root:

```bash
cd "C:\Users\AYISHA FIDHA T V\.gemini\antigravity\scratch\hitchsafe"
```

1. Run the Vercel deploy command:
   ```bash
   npx vercel
   ```

2. Follow the 4 quick terminal prompts:
   * **Set up and deploy?** Press `y` (Yes).
   * **Which scope?** Select your Vercel account.
   * **Link to existing project?** Type `n` (No).
   * **What’s your project’s name?** Press Enter (defaults to `hitchsafe`).
   * **In which directory is your code located?** Press Enter (`./`).

3. When prompted about build settings, Vercel will automatically detect `vercel.json` and deploy both the React frontend and the Python API.

4. To deploy directly to production:
   ```bash
   npx vercel --prod
   ```

You will immediately receive a live public URL (e.g. `https://hitchsafe.vercel.app`).

---

## Option 2: Deploy via GitHub (1-Click Continuous Deployment)

1. **Initialize Git & Push to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "feat: HitchSafe full-stack MVP with Vercel deployment"
   git branch -M main
   git remote add origin https://github.com/<your-username>/hitchsafe.git
   git push -u origin main
   ```

2. **Import into Vercel Dashboard**:
   * Open [https://vercel.com/new](https://vercel.com/new).
   * Select your `hitchsafe` repository and click **Import**.
   * Leave the Root Directory as `./` (Vercel automatically detects `vercel.json`).
   * Click **Deploy**.

---

## Optional Environment Variables

In your Vercel Project Dashboard (**Settings** $\to$ **Environment Variables**), you can optionally add:

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `USE_MOCK_ALERTS` | `true` | Set to `false` if using real Twilio SMS |
| `TWILIO_ACCOUNT_SID` | *(optional)* | Your Twilio Account SID for live cellular carrier SMS |
| `TWILIO_AUTH_TOKEN` | *(optional)* | Your Twilio Auth Token |
| `TWILIO_PHONE_NUMBER` | *(optional)* | Your Twilio virtual phone number |
| `TRACKING_BASE_URL` | `https://<your-project>.vercel.app/track` | Public base URL for SMS tracking links |

> [!NOTE]
> Even without Twilio credentials, the app features **Live Direct Device SMS** (`sms:`) and **Direct WhatsApp Broadcast** links that open pre-filled emergency messages on your phone with the vehicle number plate photo evidence attached!
