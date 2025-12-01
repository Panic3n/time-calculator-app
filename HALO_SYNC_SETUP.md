# Halo PSA Automatic Sync Setup

## Overview

The Time Calculator app now has **automatic hourly syncing** of Halo PSA timesheet data:

- ✅ **Manual sync** available in Admin CMS → Halo Sync tab
- ✅ **Automatic hourly sync** via Vercel Cron Jobs (every hour)
- ✅ **Auto-trigger on new fiscal year** creation
- ✅ **Latest fiscal year** prioritized for automatic sync

---

## How It Works

### 1. Manual Sync (Admin CMS)
1. Go to **Admin** → **Halo Sync** tab
2. Select a fiscal year
3. Click **Sync Now**
4. Status updates show progress and results

### 2. Automatic Hourly Sync
- Runs every hour at minute 0 (e.g., 10:00, 11:00, 12:00, etc.)
- Syncs the **latest fiscal year** automatically
- Uses stored agent mappings from database
- Logs results to Vercel Function Logs

### 3. New Fiscal Year Trigger
- When you create a new fiscal year in Admin → Fiscal Years
- Sync automatically triggers for that new year
- Happens in the background (doesn't block creation)

---

## Setup Required

### 1. Set Vercel Cron Secret

The cron job needs authentication. Add this environment variable to Vercel:

**In Vercel Dashboard → Settings → Environment Variables:**

- **Name:** `CRON_SECRET`
- **Value:** Generate a random string (e.g., `your-secret-key-here`)

### 2. Update next.config.ts

Already done! The config includes:
```typescript
crons: [
  {
    path: "/api/halopsa/sync-auto",
    schedule: "0 * * * *", // Every hour at minute 0
  },
]
```

### 3. Agent Mappings

The sync uses agent mappings stored in the `halo_agent_map` table:
- Maps Halo agent IDs to employee IDs
- Can be set up in the app UI or via API
- Automatically used for all syncs

---

## API Endpoints

### GET /api/halopsa/sync-auto
**Automatic hourly sync (Vercel Cron)**

Headers:
```
Authorization: Bearer {CRON_SECRET}
```

Response:
```json
{
  "ok": true,
  "message": "Sync completed successfully",
  "fiscalYear": "2024/2025",
  "readRows": 150,
  "importedRows": 45
}
```

### POST /api/halopsa/sync-auto
**Manual trigger for specific fiscal year**

Body:
```json
{
  "fiscalYearId": "uuid-here"
}
```

Response:
```json
{
  "ok": true,
  "message": "Manual sync triggered",
  "importedRows": 45
}
```

### POST /api/halopsa/import
**Core sync logic** (called by sync-auto)

Body:
```json
{
  "fiscalYearId": "uuid-here",
  "agentMap": {
    "agent-id-1": "employee-uuid-1",
    "agent-id-2": "employee-uuid-2"
  }
}
```

---

## Monitoring

### Check Sync Status

**Vercel Dashboard:**
1. Go to your project → **Deployments**
2. Click latest deployment
3. Click **Function Logs**
4. Search for "Starting automatic Halo sync"
5. Look for sync results and errors

**Local Development:**
```bash
npm run dev
# Check terminal for sync logs
```

### Common Log Messages

```
✅ Starting automatic Halo sync...
✅ Syncing latest fiscal year: 2024/2025 (uuid)
✅ Sync complete: readRows=150, importedRows=45

❌ No fiscal years found
❌ Could not load agent map
❌ Import failed: [error message]
```

---

## Troubleshooting

### Sync Not Running

**Check:**
1. Is `CRON_SECRET` set in Vercel environment variables?
2. Is the app deployed on Vercel?
3. Check Vercel Function Logs for errors

**Fix:**
- Add `CRON_SECRET` to Vercel environment variables
- Redeploy the app

### No Data Imported

**Check:**
1. Are agent mappings set up? (Check `halo_agent_map` table)
2. Is Halo API configured? (Check Halo env vars)
3. Are there timesheet events in Halo for the date range?

**Fix:**
- Set up agent mappings in the app
- Verify Halo credentials are correct
- Check Halo has data for the fiscal year date range

### Sync Fails with "Unauthorized"

**Check:**
- Is `CRON_SECRET` correct in Vercel?
- Is the authorization header being sent?

**Fix:**
- Verify `CRON_SECRET` matches in code and Vercel
- Check Vercel Function Logs for the exact error

---

## Files Changed

- `src/app/admin/page.tsx` - Added Halo Sync CMS section
- `src/app/api/halopsa/sync-auto/route.ts` - New automatic sync endpoint
- `next.config.ts` - Added cron job configuration

---

## Testing

### Local Test

```bash
# Start dev server
npm run dev

# Go to Admin → Halo Sync
# Select a fiscal year and click "Sync Now"
# Check terminal for logs
```

### Vercel Test

1. Deploy to Vercel
2. Add `CRON_SECRET` environment variable
3. Redeploy
4. Wait for the next hour mark (or manually trigger via Admin CMS)
5. Check Function Logs for results

---

## Schedule

- **Hourly:** Every hour at minute 0 (10:00, 11:00, 12:00, etc.)
- **On Demand:** Via Admin CMS → Halo Sync tab
- **On New FY:** Automatically when creating a new fiscal year

To change the schedule, edit `next.config.ts`:
```typescript
schedule: "0 * * * *"  // Current: every hour
schedule: "0 */6 * * *" // Every 6 hours
schedule: "0 0 * * *"   // Daily at midnight
```

---

## Security

- Cron requests require `CRON_SECRET` header
- Only Vercel can trigger the cron job
- Manual syncs require admin login
- Agent mappings stored securely in Supabase
