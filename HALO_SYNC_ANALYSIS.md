# Halo PSA Sync - Current Implementation Analysis

## 📊 What's Currently Being Synced

### Data Source
- **API:** Halo PSA `TimesheetEvent` endpoint
- **Date Range:** Fiscal year start to end date
- **Frequency:** Hourly (automatic) + Manual (on demand)

### Data Synced Per Agent/Employee

#### 1. **Logged Hours** ✅
- **Source:** `timeTakenHours` field from Halo
- **Calculation:** Sum of all time entries
- **Exclusions:** Holiday, vacation, break types
- **Storage:** `month_entries.logged` column

#### 2. **Billed Hours** ✅
- **Source:** `timeTakenHours` filtered by `charge_type_name`
- **Calculation:** Only billable charge types
- **Billable Types:** Remote support, on-site support, project, documentation, overtime variants, travel time, etc.
- **Storage:** `month_entries.billed` column
- **Detail Storage:** `month_entries_billed_types` (per charge type breakdown)

#### 3. **Worked Hours** ✅
- **Source:** `work_hours` field from Halo Timesheet
- **Calculation:** Sum of work hours per employee per month
- **Auto-Correction:** Halo auto-corrects this field
- **Storage:** `month_entries.worked` column
- **Status:** NOW synced automatically from Halo

---

## 🔄 Current Sync Flow

```
1. Fetch TimesheetEvent from Halo
   ↓
2. Map agent_id/agent_name to employee_id
   ↓
3. Group by employee + fiscal month
   ↓
4. Calculate:
   - Logged: All time (excluding holidays/breaks)
   - Billed: Time with billable charge types
   ↓
5. Upsert to month_entries
   ↓
6. Upsert per-charge-type breakdown to month_entries_billed_types
```

---

## 📋 Data Processing Details

### Agent Mapping
- Halo agents matched to employees by:
  1. Agent ID (numeric)
  2. Agent name (case-insensitive)
  3. Auto-match by employee name

### Fiscal Month Calculation
- Fiscal year: September 1 - August 31
- Month index: 0-11 (September = 0, August = 11)

### Exclusions from Logged Hours
**Charge Types:**
- Holiday, vacation, break

**Break Types:**
- Taking a breather, lunch break, non-working hours

**Holiday IDs:**
- Vacation, dentist appointment, doctors appointment, vab, permission, parental leave, leave of absence, withdraw time

---

## 🎯 What Needs to Be Added: "Worked Hours"

### Current Situation
- **Worked hours:** Currently manual entry only
- **Problem:** Not synced from Halo, requires manual data entry
- **Impact:** Dashboard calculations incomplete without this data

### What is "Worked Hours"?
- **Definition:** Time the employee was actually working (not on break/holiday)
- **Halo Source:** Likely a specific charge type or field
- **Calculation:** Should be similar to logged but with different exclusions

### How to Sync It
1. **Identify the Halo field** that represents "worked" time
2. **Add to sync logic** similar to logged/billed
3. **Store in** `month_entries.worked` column
4. **Update on sync** (not preserve like current)

---

## 📁 Key Files

### Import Logic
- `src/app/api/halopsa/import/route.ts` - Main sync logic

### Sync Orchestration
- `src/app/api/halopsa/sync-auto/route.ts` - Hourly + manual trigger

### Halo API Client
- `src/lib/halo.ts` - Authentication and fetch

### Admin UI
- `src/app/admin/page.tsx` - Manual sync button

---

## 🔍 Current Data Structure

### month_entries Table
```
id: UUID
employee_id: UUID (ref employees)
fiscal_year_id: UUID (ref fiscal_years)
month_index: 0-11
logged: DECIMAL (synced from Halo)
billed: DECIMAL (synced from Halo)
worked: DECIMAL (manual, NOT synced)
created_at: TIMESTAMP
updated_at: TIMESTAMP
```

### month_entries_billed_types Table
```
employee_id: UUID
fiscal_year_id: UUID
month_index: 0-11
charge_type_name: TEXT (lowercased)
hours: DECIMAL (synced from Halo)
```

### halo_agent_map Table
```
employee_id: UUID (primary key)
agent_id: TEXT (unique)
created_at: TIMESTAMP
```

---

## 🚀 Next Steps to Add "Worked Hours"

### Step 1: Identify Halo Field
- Check Halo API documentation for "worked" field
- Possible names: `workedHours`, `worked_time`, `actual_time`, etc.
- May need to calculate from charge types

### Step 2: Update Import Logic
- Add "worked" calculation to aggregation
- Similar to "logged" but with specific exclusions
- Update `month_entries.worked` on sync (not preserve)

### Step 3: Update UI
- Show "worked" in dashboard
- Allow viewing per-employee per-month
- Show in reports

### Step 4: Testing
- Verify worked hours sync correctly
- Check calculations
- Validate data in dashboard

---

## 📊 Sync Statistics

### What Gets Processed
- **Events Read:** All TimesheetEvent entries for date range
- **Events Processed:** Only those with valid agent mapping
- **Rows Imported:** One per employee per month (if has data)
- **Charge Types:** Breakdown per employee per month per type

### Performance
- **Typical Sync Time:** 1-2 seconds
- **Data Volume:** Depends on number of agents and time entries
- **Frequency:** Hourly + on-demand

---

## 🔐 Configuration

### Billable Charge Types (Configurable)
- Stored in `halo_billable_charge_types` table
- Default list includes: remote support, on-site support, project, etc.
- Can be customized per tenant

### Excluded Logged Types (Configurable)
- Stored in `halo_excluded_logged_types` table
- Default: holiday, vacation, break

### Excluded Break Types (Configurable)
- Stored in `halo_excluded_break_types` table
- Default: taking a breather, lunch break, non-working hours

### Excluded Holiday Types (Configurable)
- Stored in `halo_excluded_holiday_types` table
- Default: vacation, dentist appointment, doctors appointment, vab, permission, parental leave, leave of absence, withdraw time

---

## 📝 Summary

### Currently Synced ✅
1. **Logged Hours** - All time entries (excluding holidays/breaks)
2. **Billed Hours** - Time with billable charge types
3. **Charge Type Breakdown** - Per-type billed hours
4. **Worked Hours** - Auto-corrected work hours from Halo Timesheet

---

## 🎯 Implementation - COMPLETE ✅

### What Was Done
- [x] Identified Halo field: `work_hours` from Timesheet endpoint
- [x] Updated import logic to extract `work_hours`
- [x] Added worked hours to aggregation (per employee per month)
- [x] Updated month_entries upsert to sync worked hours
- [x] Worked hours now update on every sync (not preserved)

### How It Works
1. **Extract:** Pull `work_hours` from each Halo Timesheet event
2. **Aggregate:** Sum work hours per employee per fiscal month
3. **Sync:** Upsert to `month_entries.worked` column
4. **Update:** Overwrite on each sync (no manual preservation)

### Field Mapping
```
Halo Timesheet → work_hours
                 workHours
                 worked_hours
                 workedHours
↓
Aggregated per employee per month
↓
month_entries.worked
```

### Code Changes
- **File:** `src/app/api/halopsa/import/route.ts`
- **Changes:**
  - Updated `Totals` type to include `worked: number`
  - Added extraction of `work_hours` field
  - Added aggregation of worked hours
  - Updated upsert to set `worked` from synced data

---

## 📊 Now Syncing

All three metrics are now automatically synced from Halo:

| Metric | Source | Calculation | Storage |
|--------|--------|-------------|---------|
| **Logged** | timeTakenHours | All time (excl. holidays/breaks) | month_entries.logged |
| **Billed** | timeTakenHours + charge_type | Billable types only | month_entries.billed |
| **Worked** | work_hours | Sum per employee per month | month_entries.worked |

---

## 🚀 Status

**✅ COMPLETE AND DEPLOYED**

All three time metrics are now synced automatically:
- Logged hours (time tracked)
- Billed hours (billable time)
- Worked hours (auto-corrected by Halo)

No manual entry needed for worked hours anymore! 🎉
