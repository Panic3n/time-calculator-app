# Time Calculator App - Calculations Documentation

This document explains how all numerical values are calculated throughout the application. When making changes to calculations, always update this file.

---

## Table of Contents
1. [Dashboard Page](#dashboard-page)
2. [Team Page](#team-page)
3. [Team Goals Page](#team-goals-page)
4. [Admin Page](#admin-page)

---

## Dashboard Page

### Yearly Summary Section

#### Worked Hours
- **Location**: Yearly Summary card (top left)
- **Calculation**: Sum of all `worked` hours from `month_entries` for the selected employee and fiscal year
- **Formula**: `SUM(month_entries.worked WHERE employee_id = X AND fiscal_year_id = Y)`
- **Color Coding**: No color coding (displays in default text color)

#### Logged %
- **Location**: Yearly Summary card (second from left)
- **Calculation**: Percentage of logged hours vs worked hours
- **Formula**: `(SUM(logged) / SUM(worked)) * 100`
- **Color Coding**: 
  - RED if 20%+ below `personal_logged_pct_goal`
  - YELLOW if 1-19% below goal
  - GREEN if at or above goal
- **Goal Source**: `team_goals.personal_logged_pct_goal` (set in Admin)

#### Billed %
- **Location**: Yearly Summary card (third from left)
- **Calculation**: Percentage of billed hours vs worked hours
- **Formula**: `(SUM(billed) / SUM(worked)) * 100`
- **Color Coding**:
  - RED if 20%+ below `personal_billed_pct_goal`
  - YELLOW if 1-19% below goal
  - GREEN if at or above goal
- **Goal Source**: `team_goals.personal_billed_pct_goal` (set in Admin)

#### Attendance %
- **Location**: Yearly Summary card (right)
- **Calculation**: Percentage of worked hours vs available hours for the fiscal year
- **Formula**: `(SUM(worked) / fiscal_year.available_hours) * 100`
- **Color Coding**:
  - RED if 20%+ below `personal_attendance_pct_goal`
  - YELLOW if 1-19% below goal
  - GREEN if at or above goal
- **Goal Source**: `team_goals.personal_attendance_pct_goal` (set in Admin)

### Monthly Breakdown Section

Each month displays in a separate card with:

#### Worked Hours
- **Calculation**: `month_entries.worked` for that specific month
- **Formula**: `SUM(worked WHERE month_index = X)`

#### Logged Hours
- **Calculation**: `month_entries.logged` for that specific month
- **Formula**: `SUM(logged WHERE month_index = X)`

#### Billed Hours
- **Calculation**: `month_entries.billed` for that specific month
- **Formula**: `SUM(billed WHERE month_index = X)`

---

## Team Page

### Individual Employee Cards

Each employee card displays:

#### Worked Hours
- **Calculation**: Sum of all worked hours for that employee in the fiscal year
- **Formula**: `SUM(month_entries.worked WHERE employee_id = X AND fiscal_year_id = Y)`

#### Logged Hours
- **Calculation**: Sum of all logged hours for that employee in the fiscal year
- **Formula**: `SUM(month_entries.logged WHERE employee_id = X AND fiscal_year_id = Y)`

#### Billed Hours
- **Calculation**: Sum of all billed hours for that employee in the fiscal year
- **Formula**: `SUM(month_entries.billed WHERE employee_id = X AND fiscal_year_id = Y)`

#### % Logged
- **Calculation**: Percentage of logged hours vs worked hours for that employee
- **Formula**: `(logged / worked) * 100`
- **Color Coding**:
  - RED if 20%+ below `personal_logged_pct_goal`
  - YELLOW if 1-19% below goal
  - GREEN if at or above goal

#### % Billed
- **Calculation**: Percentage of billed hours vs worked hours for that employee
- **Formula**: `(billed / worked) * 100`
- **Color Coding**:
  - RED if 20%+ below `personal_billed_pct_goal`
  - YELLOW if 1-19% below goal
  - GREEN if at or above goal

#### Attendance %
- **Calculation**: Percentage of worked hours vs available hours for the fiscal year
- **Formula**: `(worked / fiscal_year.available_hours) * 100`
- **Color Coding**:
  - RED if 20%+ below `personal_attendance_pct_goal`
  - YELLOW if 1-19% below goal
  - GREEN if at or above goal

### Team Averages Section

#### % Logged (Team Average)
- **Calculation**: Total logged hours divided by total worked hours across all included employees
- **Formula**: `(SUM(all_employees.logged) / SUM(all_employees.worked)) * 100`
- **Color Coding**: Same as individual % Logged (uses `personal_logged_pct_goal`)
- **Note**: Calculated from totals, NOT from averaging individual percentages

#### % Billed (Team Average)
- **Calculation**: Total billed hours divided by total worked hours across all included employees
- **Formula**: `(SUM(all_employees.billed) / SUM(all_employees.worked)) * 100`
- **Color Coding**: Same as individual % Billed (uses `personal_billed_pct_goal`)
- **Note**: Calculated from totals, NOT from averaging individual percentages

#### Attendance % (Team Average)
- **Calculation**: MEDIAN of all individual employee attendance percentages
- **Formula**: `MEDIAN(employee1.attendance%, employee2.attendance%, ...)`
- **Color Coding**: Same as individual Attendance % (uses `personal_attendance_pct_goal`)
- **Note**: Uses median instead of total to avoid skewing by outliers

---

## Team Goals Page

### Team Section

#### Department TB Goal
- **Location**: Team section card
- **Source**: `team_goals.department_tb_goal` (set in Admin)
- **Display Format**: Swedish number formatting with thousand separators (e.g., "1 234 567")
- **Calculation**: No calculation, direct display from database

#### Billable Hours Needed
- **Location**: Team section card (below Department TB Goal)
- **Calculation**: Department TB goal divided by average billed rate goal
- **Formula**: `department_tb_goal / team_avg_rate_goal`
- **Display Format**: Rounded to 1 decimal place

#### Team Billed % Goal
- **Location**: Team section card
- **Source**: `team_goals.team_billed_pct_goal` (set in Admin)
- **Calculation**: No calculation, direct display from database

#### Team Billable Hours Goal
- **Location**: Team section card
- **Source**: `team_goals.team_billable_hours_goal` (set in Admin)
- **Calculation**: No calculation, direct display from database
- **Note**: Calculated dynamically from `department_tb_goal / team_avg_rate_goal` if department TB goal is set

#### Team Average Billed Rate Goal
- **Location**: Team section card
- **Source**: `team_goals.team_avg_rate_goal` (set in Admin)
- **Calculation**: No calculation, direct display from database

### Personal Section

#### Personal Billed % Goal
- **Location**: Personal section card
- **Source**: `team_goals.personal_billed_pct_goal` (set in Admin)
- **Calculation**: No calculation, direct display from database

#### Personal Logged % Goal
- **Location**: Personal section card
- **Source**: `team_goals.personal_logged_pct_goal` (set in Admin)
- **Calculation**: No calculation, direct display from database

#### Personal Attendance % Goal
- **Location**: Personal section card
- **Source**: `team_goals.personal_attendance_pct_goal` (set in Admin)
- **Calculation**: No calculation, direct display from database

#### Personal Feedback Score Goal
- **Location**: Personal section card
- **Source**: `team_goals.personal_feedback_score_goal` (set in Admin)
- **Calculation**: No calculation, direct display from database

### Progress Bars

Each progress bar displays:
- **Actual Value**: Current metric value (e.g., current billed %)
- **Goal Value**: Target value from team goals
- **Progress**: `(actual / goal) * 100`
- **Color Coding**:
  - RED if 20%+ below goal
  - YELLOW if 1-19% below goal
  - GREEN if at or above goal

---

## Admin Page

### Team Goals Settings

#### Department Teckningsbidrag (TB) Goal
- **Location**: Admin > Goals > Department Teckningsbidrag Goal section
- **Field**: `team_goals.department_tb_goal`
- **Type**: Numeric input
- **Display Format**: Swedish number formatting with thousand separators
- **Used For**: Calculating billable hours needed to meet department TB goal

#### Billable Hours Needed (Read-only)
- **Location**: Admin > Goals > Department Teckningsbidrag Goal section
- **Calculation**: `department_tb_goal / team_avg_rate_goal`
- **Formula**: Divides department TB goal by average billed rate goal
- **Display Format**: Rounded to 1 decimal place
- **Note**: Auto-updates when either department TB goal or average rate goal changes

#### Team Billed % Goal
- **Location**: Admin > Goals > Team section
- **Field**: `team_goals.team_billed_pct_goal`
- **Type**: Numeric input (percentage)
- **Used For**: Color-coding team metrics on Team page and Team Goals page

#### Team Billable Hours Goal
- **Location**: Admin > Goals > Team section
- **Field**: `team_goals.team_billable_hours_goal`
- **Type**: Numeric input (hours)
- **Calculation**: Dynamically calculated from `department_tb_goal / team_avg_rate_goal` if department TB goal is set
- **Formula**: `department_tb_goal / team_avg_rate_goal`
- **Note**: Removed manual input; now auto-calculated

#### Team Average Billed Rate Goal
- **Location**: Admin > Goals > Team section
- **Field**: `team_goals.team_avg_rate_goal`
- **Type**: Numeric input (SEK/hour)
- **Used For**: Calculating billable hours needed from department TB goal

#### Projected Average Billed Rate
- **Location**: Admin > Goals > Team section (read-only)
- **Calculation**: `new_department_tb_goal / new_billable_hours_goal`
- **Formula**: Divides updated department TB goal by updated billable hours goal
- **Display Format**: Rounded to 2 decimal places
- **Note**: Shows what the average rate would be with current settings

#### Personal Billed % Goal
- **Location**: Admin > Goals > Personal section
- **Field**: `team_goals.personal_billed_pct_goal`
- **Type**: Numeric input (percentage)
- **Used For**: Color-coding individual billed % on Dashboard and Team pages

#### Personal Logged % Goal
- **Location**: Admin > Goals > Personal section
- **Field**: `team_goals.personal_logged_pct_goal`
- **Type**: Numeric input (percentage)
- **Used For**: Color-coding individual logged % on Dashboard and Team pages

#### Personal Attendance % Goal
- **Location**: Admin > Goals > Personal section
- **Field**: `team_goals.personal_attendance_pct_goal`
- **Type**: Numeric input (percentage)
- **Used For**: Color-coding individual attendance % on Dashboard and Team pages

#### Personal Feedback Score Goal
- **Location**: Admin > Goals > Personal section
- **Field**: `team_goals.personal_feedback_score_goal`
- **Type**: Numeric input
- **Used For**: Future feedback scoring feature

---

## Color Coding Logic

All percentage values use the same RED/YELLOW/GREEN logic:

```
IF (goal - value) / goal * 100 >= 20:
  Color = RED
ELSE IF (goal - value) / goal * 100 >= 1:
  Color = YELLOW
ELSE:
  Color = GREEN
```

**Interpretation:**
- **RED**: Performance is 20% or more below the goal (needs attention)
- **YELLOW**: Performance is 1-19% below the goal (slightly below target)
- **GREEN**: Performance is at or above the goal (on track)

---

## Data Sources

### Database Tables

#### `month_entries`
- Stores monthly time tracking data per employee
- Fields: `employee_id`, `fiscal_year_id`, `month_index`, `worked`, `logged`, `billed`
- Used for: All Dashboard and Team page calculations

#### `team_goals`
- Stores team and personal goals per fiscal year
- Fields: 
  - `fiscal_year_id`
  - `department_tb_goal`
  - `team_billed_pct_goal`
  - `team_billable_hours_goal`
  - `team_avg_rate_goal`
  - `personal_billed_pct_goal`
  - `personal_logged_pct_goal`
  - `personal_attendance_pct_goal`
  - `personal_feedback_score_goal`
- Used for: All goal-related displays and color-coding

#### `fiscal_years`
- Stores fiscal year information
- Fields: `id`, `label`, `start_date`, `end_date`, `available_hours`
- Used for: Attendance % calculations

#### `employees`
- Stores employee information
- Fields: `id`, `name`, `role`
- Used for: Employee name and role displays

---

## Summary of Key Formulas

| Metric | Formula | Location |
|--------|---------|----------|
| Worked Hours | `SUM(month_entries.worked)` | Dashboard, Team |
| Logged % | `(SUM(logged) / SUM(worked)) * 100` | Dashboard, Team |
| Billed % | `(SUM(billed) / SUM(worked)) * 100` | Dashboard, Team |
| Attendance % | `(SUM(worked) / available_hours) * 100` | Dashboard, Team |
| Team Avg Logged % | `(SUM(all_logged) / SUM(all_worked)) * 100` | Team Averages |
| Team Avg Billed % | `(SUM(all_billed) / SUM(all_worked)) * 100` | Team Averages |
| Team Avg Attendance % | `MEDIAN(all_attendance_pcts)` | Team Averages |
| Billable Hours Needed | `department_tb_goal / team_avg_rate_goal` | Admin, Team Goals |
| Projected Avg Rate | `new_tb_goal / new_billable_hours_goal` | Admin |

---

## Change Log

### Version 1.0 - Initial Documentation
- Documented all calculations across Dashboard, Team, Team Goals, and Admin pages
- Documented color-coding logic
- Documented data sources and database tables
- Documented key formulas

---

**Last Updated**: November 27, 2025
**Maintained By**: Development Team
