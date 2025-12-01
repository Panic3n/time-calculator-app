# Worked Hours Precision Issue

## Issue
Erik Damber's worked hours in November:
- **Halo shows:** 166:36 (166 hours 36 minutes = 166.6 hours)
- **App shows:** 164.85 hours
- **Difference:** 1.75 hours

## Possible Causes

### 1. Precision Rounding
- We now use 4 decimal places (10000x rounding)
- This should preserve precision from Halo API

### 2. Timesheet Data Completeness
- Timesheet endpoint might not include all days
- Some entries might not be finalized in Halo
- Partial days might not be included

### 3. Halo UI vs API Difference
- Halo UI might show calculated/rounded values
- API might return raw values
- Different aggregation methods

### 4. Data Sync Timing
- Timesheet might not be fully updated
- Some entries might be pending
- Caching or delayed updates

## Investigation Steps

### Step 1: Check Halo Directly
1. Go to Halo PSA
2. Find Erik Damber's timesheet for November
3. Check if it's finalized/locked
4. Note the exact work_hours value

### Step 2: Check API Data
Run this diagnostic to see all work_hours for November:

```bash
curl -X POST http://localhost:3001/api/halopsa/diagnostic \
  -H "Content-Type: application/json" \
  -d '{
    "from": "2024-11-01",
    "to": "2024-11-30",
    "entity": "Timesheet",
    "limit": 5000
  }'
```

Look for Erik Damber in the response and sum all work_hours values.

### Step 3: Compare Values
- Halo UI value: 166.6 hours
- API total: ? hours
- Difference: ? hours

## Solution Options

### Option A: Accept Small Differences
- 1.75 hours difference might be acceptable
- Could be due to rounding or data timing
- Monitor if pattern is consistent

### Option B: Investigate Data Source
- Check if Timesheet endpoint is the right source
- Verify all days are included
- Check for missing or partial entries

### Option C: Use Different Field
- Check if there's another field in Halo that matches better
- Might need to use `actual_hours` or `chargeable_hours`
- Verify which field Halo uses for "worked hours"

## Current Implementation

**File:** `src/app/api/halopsa/import/route.ts`

**Precision:** 4 decimal places (0.0001)
```typescript
worked: Math.round(totals.worked * 10000) / 10000
```

**Data Source:** Halo `/Timesheet` endpoint
- Field: `work_hours`
- Aggregation: Sum per agent per day, then per agent per month
- Deduplication: Only count once per agent per day

## Next Steps

1. **Verify Halo data** - Check if Erik Damber's timesheet is complete
2. **Compare API values** - Run diagnostic and sum work_hours
3. **Identify pattern** - Check if other employees have similar discrepancies
4. **Decide approach** - Accept difference or investigate further

---

**Status:** Waiting for data verification
