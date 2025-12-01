# Worked Hours Debug Guide

**Issue:** Worked hours showing as 0 for all employees

---

## 🔍 Diagnostic Steps

### Step 1: Check if work_hours field exists in Halo

Use the diagnostic endpoint to inspect Halo data:

```bash
curl -X POST http://localhost:3001/api/halopsa/diagnostic \
  -H "Content-Type: application/json" \
  -d '{
    "from": "2024-09-01",
    "to": "2024-09-30",
    "entity": "TimesheetEvent",
    "limit": 100
  }'
```

**Look for in response:**
- `fields_seen` array - Check if it contains `work_hours`, `workHours`, `worked_hours`, or `workedHours`
- `counters.worked_hours_present_rows` - Should be > 0 if field exists
- `counters.worked_hours_gt0_rows` - Should be > 0 if field has values
- `counters.total_worked_hours` - Should be > 0 if data exists

### Step 2: Check sample data

In the diagnostic response, look at the `sample` array (first 5 events):

```json
{
  "sample": [
    {
      "agentName": "John Doe",
      "timeTakenHours": 8,
      "work_hours": 7.5,  // ← Look for this field
      "charge_type_name": "Remote Support",
      ...
    }
  ]
}
```

**Expected:** Each event should have a `work_hours` field with a numeric value > 0

---

## 🐛 Possible Issues & Solutions

### Issue 1: Field Not in Response
**Symptom:** `fields_seen` doesn't include work_hours variants

**Cause:** Halo API might not return this field by default

**Solution:**
1. Check Halo API documentation for field name
2. Verify API endpoint is `/TimesheetEvent` (not `/Timesheet`)
3. Check if field needs to be explicitly requested

### Issue 2: Field Exists but All Values are 0
**Symptom:** `worked_hours_present_rows` > 0 but `worked_hours_gt0_rows` = 0

**Cause:** Halo might not be calculating work_hours yet

**Solution:**
1. Verify Halo has processed the timesheet entries
2. Check if work_hours needs to be manually calculated in Halo
3. Verify entries are marked as "complete" in Halo

### Issue 3: Field Name Mismatch
**Symptom:** Field exists in Halo but not being extracted

**Cause:** Field name doesn't match our extraction list

**Solution:**
1. Check exact field name in Halo response
2. Add to extraction list in import logic:
   ```typescript
   const worked = Number(
     pick<any>(ev, [
       "work_hours",
       "workHours",
       "worked_hours",
       "workedHours",
       "YOUR_FIELD_NAME"  // ← Add here
     ]) ?? 0
   );
   ```

### Issue 4: Wrong API Endpoint
**Symptom:** No work_hours field in any response

**Cause:** Using wrong endpoint

**Solution:**
1. Verify we're fetching from `/TimesheetEvent` (not `/Timesheet`)
2. Check if there's a separate `/Timesheet` endpoint with work_hours
3. Verify Halo API documentation

---

## 📊 Diagnostic Response Example

### Good Response (work_hours present)
```json
{
  "ok": true,
  "counters": {
    "total_rows": 150,
    "total_hours": 1200,
    "worked_hours_present_rows": 150,
    "worked_hours_gt0_rows": 145,
    "total_worked_hours": 1150
  },
  "fields_seen": [
    "agentName",
    "work_hours",
    "timeTakenHours",
    ...
  ]
}
```

### Bad Response (work_hours missing)
```json
{
  "ok": true,
  "counters": {
    "total_rows": 150,
    "total_hours": 1200,
    "worked_hours_present_rows": 0,
    "worked_hours_gt0_rows": 0,
    "total_worked_hours": 0
  },
  "fields_seen": [
    "agentName",
    "timeTakenHours",
    ...
    // NO work_hours field
  ]
}
```

---

## 🔧 How to Fix

### If Field Name is Different

1. Run diagnostic to find actual field name
2. Update import logic:
   ```typescript
   // In src/app/api/halopsa/import/route.ts, line ~196
   const worked = Number(
     pick<any>(ev, [
       "work_hours",
       "workHours",
       "worked_hours",
       "workedHours",
       "ACTUAL_FIELD_NAME"  // ← Add correct name
     ]) ?? 0
   );
   ```
3. Commit and redeploy

### If Using Wrong Endpoint

1. Check Halo API docs for correct endpoint
2. Update import logic:
   ```typescript
   // In src/app/api/halopsa/import/route.ts, line ~107
   const events: any[] = await haloFetch("Timesheet", { query });  // ← Change endpoint
   ```
3. Commit and redeploy

### If Halo Needs Configuration

1. Contact Halo support to enable work_hours calculation
2. Verify timesheet entries are "complete" in Halo
3. Re-run sync after Halo configuration

---

## 📝 Testing After Fix

### Step 1: Run Diagnostic
```bash
curl -X POST http://localhost:3001/api/halopsa/diagnostic \
  -H "Content-Type: application/json" \
  -d '{
    "from": "2024-09-01",
    "to": "2024-09-30"
  }'
```

**Verify:**
- `worked_hours_present_rows` > 0
- `worked_hours_gt0_rows` > 0
- `total_worked_hours` > 0

### Step 2: Run Manual Sync
```bash
# Go to Admin → Halo Sync
# Select fiscal year
# Click "Sync Now"
```

**Verify:**
- Sync completes successfully
- Check database for updated worked values

### Step 3: Check Database
```sql
SELECT 
  employee_id,
  month_index,
  logged,
  billed,
  worked
FROM month_entries
WHERE fiscal_year_id = 'your-fy-id'
  AND worked > 0
LIMIT 10;
```

**Expected:** `worked` column should have values > 0

---

## 🆘 Still Not Working?

### Check Logs

1. **Local Dev:**
   ```bash
   # Terminal where npm run dev is running
   # Look for errors in sync output
   ```

2. **Vercel Production:**
   - Go to Vercel Dashboard
   - Click Deployments → Function Logs
   - Search for "halopsa" or "import"
   - Look for error messages

### Common Error Messages

**"work_hours field not found"**
- Field doesn't exist in Halo response
- Check field name in diagnostic

**"work_hours is always 0"**
- Halo not calculating this field
- Contact Halo support

**"TimesheetEvent endpoint not returning work_hours"**
- Wrong endpoint or Halo API version
- Check Halo API documentation

---

## 📞 Next Steps

1. **Run diagnostic** to check if work_hours field exists
2. **Share diagnostic output** if field is missing
3. **Update field name** if it's different
4. **Re-run sync** to verify fix
5. **Check database** for updated values

---

## 📋 Checklist

- [ ] Run diagnostic endpoint
- [ ] Check if work_hours field exists
- [ ] Verify field has values > 0
- [ ] Update field name if needed
- [ ] Commit changes
- [ ] Redeploy
- [ ] Run manual sync
- [ ] Verify database has worked hours

---

**Status:** Ready to debug! 🔍
