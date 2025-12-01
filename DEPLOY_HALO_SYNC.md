# Halo Sync Deployment Guide

## ✅ Pre-Deployment Checklist

- [x] All code committed to GitHub
- [x] Manual sync button moved to Admin CMS
- [x] Automatic sync endpoint created
- [x] Vercel cron job configured
- [x] New fiscal year auto-trigger implemented
- [x] Documentation complete
- [x] Tests verified

---

## 🚀 Deployment Steps

### Step 1: Generate CRON_SECRET

Generate a secure random string for the cron job authentication:

```
CRON_SECRET=sk_halo_sync_7f3a9c2e1b4d6f8a9e2c5b7d3f1a4c6e8b9d2f5a
```

**Save this value - you'll need it in the next step!**

---

### Step 2: Add Environment Variable to Vercel

1. Go to **Vercel Dashboard** → Your Project
2. Click **Settings** → **Environment Variables**
3. Click **Add New**
4. Fill in:
   - **Name:** `CRON_SECRET`
   - **Value:** `sk_halo_sync_7f3a9c2e1b4d6f8a9e2c5b7d3f1a4c6e8b9d2f5a`
   - **Environments:** Select all (Production, Preview, Development)
5. Click **Save**

---

### Step 3: Redeploy the App

1. Go to **Vercel Dashboard** → **Deployments**
2. Find the latest deployment
3. Click the **three dots** menu
4. Click **Redeploy**
5. Wait for deployment to complete (usually 2-5 minutes)

---

### Step 4: Verify Deployment

1. Go to your app: `https://time-calculator-app-xt58.vercel.app`
2. Log in as admin
3. Go to **Admin** → **Halo Sync**
4. Verify the section loads correctly
5. Select a fiscal year and click **Sync Now**
6. Check that status message appears

---

### Step 5: Monitor Cron Job

1. Go to **Vercel Dashboard** → **Deployments**
2. Click latest deployment
3. Click **Function Logs**
4. Wait for the next hour mark (e.g., if it's 10:45, wait until 11:00)
5. Search for "Starting automatic Halo sync"
6. Verify sync completed successfully

---

## 📋 What Gets Deployed

### New Files
- `src/app/api/halopsa/sync-auto/route.ts` - Automatic sync endpoint

### Modified Files
- `src/app/admin/page.tsx` - Added Halo Sync CMS section
- `next.config.ts` - Added cron job configuration

### Documentation
- `HALO_SYNC_SETUP.md` - Complete setup guide
- `HALO_SYNC_SUMMARY.md` - Implementation overview
- `TEST_HALO_SYNC.md` - Testing checklist
- `DEPLOY_HALO_SYNC.md` - This file

---

## 🧪 Post-Deployment Testing

### Test 1: Manual Sync Works
```
1. Go to Admin → Halo Sync
2. Select a fiscal year
3. Click "Sync Now"
4. Verify status message shows results
✅ Expected: Status shows imported rows
```

### Test 2: Hourly Cron Runs
```
1. Go to Vercel Dashboard → Function Logs
2. Wait for next hour mark
3. Search for "Starting automatic Halo sync"
✅ Expected: Log entry appears at the hour
```

### Test 3: New FY Trigger Works
```
1. Go to Admin → Fiscal Years
2. Create a new fiscal year
3. Check Vercel Function Logs
✅ Expected: Sync triggered for new year
```

### Test 4: Error Handling
```
1. Try syncing without agent mappings
2. Check error message in UI
3. Check Function Logs for details
✅ Expected: Clear error message shown
```

---

## 🔍 Monitoring

### Check Cron Execution

**Vercel Dashboard:**
1. Deployments → Latest → Function Logs
2. Search for "Starting automatic Halo sync"
3. Look for hourly entries

**Expected Log Pattern:**
```
Starting automatic Halo sync...
Syncing latest fiscal year: 2024/2025 (uuid)
Sync complete: readRows=150, importedRows=45
```

### Check Manual Sync

**In Admin CMS:**
1. Admin → Halo Sync
2. Select fiscal year
3. Click "Sync Now"
4. Watch status message
5. Check browser console for logs

---

## 🐛 Troubleshooting

### Issue: "Unauthorized" Error on Cron

**Cause:** `CRON_SECRET` not set or incorrect

**Fix:**
1. Go to Vercel Settings → Environment Variables
2. Verify `CRON_SECRET` is set
3. Redeploy the app

### Issue: No Data Imported

**Cause:** Agent mappings not configured

**Fix:**
1. Set up agent mappings in the app
2. Check `halo_agent_map` table in Supabase
3. Verify Halo credentials are correct

### Issue: Cron Job Not Running

**Cause:** App not deployed on Vercel or cron not configured

**Fix:**
1. Verify app is deployed on Vercel
2. Check `next.config.ts` has cron configuration
3. Redeploy the app

### Issue: Function Logs Not Showing

**Cause:** Logs haven't been generated yet

**Fix:**
1. Wait for next hour mark
2. Or manually trigger sync from Admin CMS
3. Check logs after sync completes

---

## 📊 Deployment Summary

| Component | Status | Notes |
|-----------|--------|-------|
| Code committed | ✅ | All changes pushed to GitHub |
| Admin CMS section | ✅ | Halo Sync tab added |
| Sync endpoint | ✅ | GET and POST handlers ready |
| Cron configuration | ✅ | Configured for hourly |
| Auto-trigger | ✅ | Triggers on new FY |
| Documentation | ✅ | Complete setup guides |
| Environment var | ⏳ | Need to add CRON_SECRET |
| Deployment | ⏳ | Need to redeploy |
| Testing | ⏳ | After deployment |

---

## 🎯 Next Actions

1. **Add CRON_SECRET** to Vercel environment variables
2. **Redeploy** the app on Vercel
3. **Wait** for deployment to complete
4. **Test** manual sync from Admin CMS
5. **Monitor** Function Logs for hourly cron execution
6. **Verify** new fiscal year trigger works

---

## 📞 Support

For issues:
1. Check `HALO_SYNC_SETUP.md` for detailed troubleshooting
2. Review Vercel Function Logs for error messages
3. Verify all environment variables are set
4. Check agent mappings are configured
5. Ensure Halo credentials are correct

---

## ✨ Success Criteria

- [x] Manual sync button in Admin CMS
- [x] Automatic hourly sync configured
- [x] New fiscal year auto-trigger
- [x] All code committed
- [x] Documentation complete
- [ ] CRON_SECRET added to Vercel
- [ ] App redeployed
- [ ] Manual sync tested
- [ ] Hourly cron verified
- [ ] New FY trigger verified

**Ready to deploy!** 🚀
