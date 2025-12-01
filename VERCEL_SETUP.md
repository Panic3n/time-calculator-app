# Vercel Deployment Setup Guide

## Step 1: Deploy to Vercel

1. Go to https://vercel.com/new
2. Click **Import Git Repository**
3. Select your GitHub repository: `Panic3n/time-calculator-app`
4. Click **Import**
5. Click **Deploy**

Your app will deploy! ✅

---

## Step 2: Add Environment Variables

After deployment, you need to add environment variables:

### In Vercel Dashboard:

1. Go to your project → **Settings** → **Environment Variables**
2. Add each variable below by clicking **Add**

### Required Variables:

#### Supabase (Required for app to work)
- **Name:** `NEXT_PUBLIC_SUPABASE_URL`
  **Value:** Your Supabase project URL (from Supabase dashboard)
  
- **Name:** `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  **Value:** Your Supabase anon key (from Supabase dashboard)

- **Name:** `SUPABASE_SERVICE_ROLE_KEY`
  **Value:** Your Supabase service role key (from Supabase dashboard → Settings → API)

#### Halo Integration (For Company News)
- **Name:** `HALO_API_BASE`
  **Value:** Your Halo API base URL (e.g., `https://api.haloitsm.com/api`)

- **Name:** `HALO_AUTH_BASE`
  **Value:** Your Halo auth base URL (e.g., `https://api.haloitsm.com/auth`)

- **Name:** `HALO_CLIENT_ID`
  **Value:** Your Halo client ID (from Halo settings)

- **Name:** `HALO_CLIENT_SECRET`
  **Value:** Your Halo client secret (from Halo settings)

- **Name:** `HALO_NEWS_FOLDER_ID`
  **Value:** The folder ID for "News (internt)" in your Halo KB
  
  **How to find it:**
  1. Go to your Halo instance
  2. Navigate to Knowledge Base
  3. Find the "News (internt)" folder
  4. The folder ID is in the URL or you can get it from the API

#### Optional Halo Settings
- **Name:** `HALO_SCOPE`
  **Value:** `all` (default)

- **Name:** `HALO_TENANT`
  **Value:** Your Halo tenant ID (if required by your Halo setup)

---

## Step 3: Redeploy with Environment Variables

1. After adding all environment variables, click **Deployments**
2. Click the three dots (...) on the latest deployment
3. Click **Redeploy**
4. Wait for the deployment to complete

Your app is now live with all features! 🚀

---

## Step 4: Configure Supabase Redirect URLs

For authentication to work on Vercel:

1. Go to your Supabase Dashboard → Your Project
2. Click **Authentication** → **URL Configuration**
3. Under **Redirect URLs**, add:
   - `https://your-vercel-domain.vercel.app/auth`
   - `https://your-vercel-domain.vercel.app/`
   - `https://your-vercel-domain.vercel.app/dashboard`

4. Set **Site URL** to: `https://your-vercel-domain.vercel.app`

5. Click **Save**

---

## Step 5: Set Up Message Board in Supabase

1. Go to your Supabase Dashboard
2. Click **SQL Editor**
3. Click **New Query**
4. Copy and paste the SQL from `SETUP_MESSAGE_BOARD.sql`
5. Click **Run**

The message board table is now created! ✅

---

## Troubleshooting

### App shows "Redirecting to Auth" but won't load
- **Check:** Are all Supabase environment variables set?
- **Check:** Is `NEXT_PUBLIC_SUPABASE_URL` correct?
- **Check:** Is `NEXT_PUBLIC_SUPABASE_ANON_KEY` correct?

### Login fails with "Invalid redirect"
- **Fix:** Add your Vercel domain to Supabase redirect URLs (Step 4)
- **Fix:** Make sure the domain matches exactly (with or without www)

### Company News section is empty
- **Check:** Is `HALO_NEWS_FOLDER_ID` set?
- **Check:** Is the folder ID correct?
- **Check:** Are Halo credentials (`HALO_CLIENT_ID`, `HALO_CLIENT_SECRET`) correct?

### Message Board save fails
- **Check:** Is `SUPABASE_SERVICE_ROLE_KEY` set?
- **Check:** Did you run the SQL setup script?
- **Check:** Are you logged in as an admin?

### Build fails on Vercel
- **Check:** Are all required environment variables set?
- **Check:** Did you redeploy after adding variables?

---

## Getting Your Credentials

### Supabase Credentials:
1. Go to https://supabase.com → Your Project
2. Click **Settings** → **API**
3. Copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` → `SUPABASE_SERVICE_ROLE_KEY`

### Halo Credentials:
1. Go to your Halo instance
2. Navigate to **Settings** → **API**
3. Create or find your API credentials
4. Copy:
   - API Base URL → `HALO_API_BASE`
   - Auth Base URL → `HALO_AUTH_BASE`
   - Client ID → `HALO_CLIENT_ID`
   - Client Secret → `HALO_CLIENT_SECRET`

---

## Vercel Domain

Your app will be available at: `https://time-calculator-app-xt58.vercel.app`

You can also add a custom domain in Vercel Settings → Domains.

---

## Need Help?

Check the logs:
1. Go to Vercel Dashboard → Your Project → **Deployments**
2. Click the latest deployment
3. Click **Logs** to see build and runtime errors
4. Check **Function Logs** for API errors
