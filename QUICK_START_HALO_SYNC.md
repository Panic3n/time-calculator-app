# Halo Sync - Quick Start Guide

## 🚀 Deploy in 3 Steps

### 1️⃣ Generate Secret
```
CRON_SECRET=sk_halo_sync_7f3a9c2e1b4d6f8a9e2c5b7d3f1a4c6e8b9d2f5a
```

### 2️⃣ Add to Vercel
- Vercel Dashboard → Settings → Environment Variables
- Name: `CRON_SECRET`
- Value: (paste above)
- Save

### 3️⃣ Redeploy
- Vercel Dashboard → Deployments
- Click three dots on latest
- Click Redeploy
- Wait for completion

---

## ✅ Verify It Works

### Manual Sync
1. Go to Admin → Halo Sync
2. Select fiscal year
3. Click "Sync Now"
4. ✅ Status message appears

### Automatic Sync
1. Go to Vercel → Deployments → Function Logs
2. Wait for next hour mark
3. Search "Starting automatic Halo sync"
4. ✅ Log entry appears

### New FY Trigger
1. Go to Admin → Fiscal Years
2. Create new fiscal year
3. Check Function Logs
4. ✅ Sync triggered

---

## 📚 Full Documentation

- **Setup:** `HALO_SYNC_SETUP.md`
- **Deploy:** `DEPLOY_HALO_SYNC.md`
- **Test:** `TEST_HALO_SYNC.md`
- **Status:** `HALO_SYNC_STATUS.md`

---

## 🔧 Features

✅ Manual sync from Admin CMS
✅ Automatic hourly sync
✅ Auto-trigger on new fiscal year
✅ Real-time status updates
✅ Clear error messages
✅ Detailed logging

---

## 🐛 Troubleshooting

**Cron not running?**
- Check CRON_SECRET is set in Vercel
- Redeploy the app

**No data imported?**
- Set up agent mappings
- Check Halo credentials
- Verify data exists in Halo

**Unauthorized error?**
- Verify CRON_SECRET value
- Check it matches in Vercel
- Redeploy

---

## 📊 What Gets Synced

- Timesheet events from Halo
- Logged hours per employee per month
- Billable hours per employee per month
- Charge type breakdown

---

## ⏰ Schedule

- **Manual:** Anytime via Admin CMS
- **Automatic:** Every hour at minute 0
- **New FY:** Immediately when created

---

## 🎯 You're All Set!

Everything is implemented and tested. Just add the environment variable and redeploy! 🚀
