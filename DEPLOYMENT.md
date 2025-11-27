# Deployment Guide - Time Calculator App

## Vercel Deployment Instructions

### Prerequisites
- Vercel account (https://vercel.com)
- GitHub repository with the code pushed to `main` branch
- Supabase project with API keys

### Environment Variables Required

Set these in Vercel project settings under "Environment Variables":

```
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

### Deployment Steps

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Ready for production deployment"
   git push origin main
   ```

2. **Connect to Vercel**
   - Go to https://vercel.com/new
   - Import your GitHub repository
   - Select the repository and click "Import"

3. **Configure Project**
   - Framework: Next.js (auto-detected)
   - Root Directory: ./
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm ci`

4. **Add Environment Variables**
   - In Vercel dashboard, go to Settings > Environment Variables
   - Add `NEXT_PUBLIC_SUPABASE_URL`
   - Add `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Make sure they're set for Production environment

5. **Deploy**
   - Click "Deploy"
   - Wait for build to complete
   - Your app will be live at `https://<project-name>.vercel.app`

### Database Setup

Ensure your Supabase database has the following tables:
- `employees`
- `fiscal_years`
- `month_entries`
- `team_goals`
- `app_profiles`
- `included_team_members`
- `included_charge_types`
- `budgets`
- `halo_billable_charge_types`
- `month_entries_billed_types`

### Post-Deployment Checklist

- [ ] Test login functionality
- [ ] Verify Dashboard loads correctly
- [ ] Verify Team Goals page loads correctly
- [ ] Test admin access (should redirect non-admins)
- [ ] Verify color-coding works correctly
- [ ] Test fiscal year selection
- [ ] Verify all calculations are correct
- [ ] Check that users can only access Dashboard and Team Goals
- [ ] Verify admin can access all pages

### Monitoring

- Monitor Vercel Analytics dashboard
- Check Supabase logs for any errors
- Set up error tracking (optional: Sentry, LogRocket)

### Rollback

If issues occur:
1. Go to Vercel project > Deployments
2. Find the previous working deployment
3. Click the three dots menu and select "Promote to Production"

### Support

For issues:
- Check Vercel logs: Vercel Dashboard > Deployments > Logs
- Check Supabase logs: Supabase Dashboard > Logs
- Review CALCULATIONS.md for formula verification
