# Debug Message Board Save Issue

## Quick Checklist

### 1. Database Table Exists
```bash
# In Supabase SQL Editor, run:
SELECT * FROM public.message_board;
```
- ✅ If you see a row with `id: 'main'`, the table exists
- ❌ If error "relation does not exist", run `SETUP_MESSAGE_BOARD.sql`

### 2. Check Supabase Service Role Key
```
In Vercel Environment Variables:
- SUPABASE_SERVICE_ROLE_KEY should be set
- It should be different from NEXT_PUBLIC_SUPABASE_ANON_KEY
- It should start with "eyJ..." (JWT format)
```

### 3. Check RLS Policies
In Supabase → message_board table → RLS:
- ✅ "Allow public read" policy exists
- ✅ "Allow admin write" policy exists
- ✅ "Allow admin update" policy exists

If missing, run the SQL setup again.

### 4. Check Admin Status
```
In Supabase, run:
SELECT user_id, is_admin FROM public.app_profiles 
WHERE user_id = 'YOUR_USER_ID';
```
- ✅ Should show `is_admin: true`
- ❌ If false or missing, update it to true

### 5. Check Browser Console
1. Open browser DevTools (F12)
2. Go to **Console** tab
3. Try to save a message
4. Look for error messages
5. Copy the error and share it

### 6. Check Vercel Logs
1. Go to Vercel Dashboard → Your Project
2. Click **Deployments** → Latest deployment
3. Click **Function Logs**
4. Look for "Saving message board" or error messages
5. Copy any errors

### 7. Test Locally First
```bash
# Run locally
npm run dev

# Go to http://localhost:3000/admin
# Try to save a message
# Check terminal for logs
```

## Common Errors

### "Failed to save message" with no details
**Cause:** Service role key not set
**Fix:** Add `SUPABASE_SERVICE_ROLE_KEY` to Vercel environment variables

### "relation 'public.message_board' does not exist"
**Cause:** Table not created
**Fix:** Run `SETUP_MESSAGE_BOARD.sql` in Supabase SQL Editor

### "new row violates row level security policy"
**Cause:** RLS policy doesn't allow admin writes
**Fix:** Check that admin user has `is_admin: true` in app_profiles

### "permission denied for schema public"
**Cause:** Using anon key instead of service role key
**Fix:** Make sure `SUPABASE_SERVICE_ROLE_KEY` is set (not anon key)

## Step-by-Step Debug

1. **Check table exists:**
   ```sql
   SELECT * FROM public.message_board LIMIT 1;
   ```

2. **Check RLS policies:**
   ```sql
   SELECT policyname, permissive, roles, qual, with_check 
   FROM pg_policies 
   WHERE tablename = 'message_board';
   ```

3. **Check admin user:**
   ```sql
   SELECT * FROM public.app_profiles 
   WHERE is_admin = true;
   ```

4. **Test insert directly:**
   ```sql
   INSERT INTO public.message_board (id, title, content)
   VALUES ('test', 'Test Title', 'Test Content')
   ON CONFLICT (id) DO UPDATE SET title = 'Test Title', content = 'Test Content';
   ```

5. **Check Vercel logs:**
   - Look for "Saving message board" log
   - Look for "Supabase upsert error"
   - Copy exact error message

## Need Help?

Share:
1. The exact error message from the alert
2. Browser console errors (F12 → Console)
3. Vercel Function Logs output
4. Screenshot of Vercel environment variables (hide secrets)
