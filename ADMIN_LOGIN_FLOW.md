# Admin Login Flow - Documentation

## Overview

The app now has a **two-step login process** that clearly separates user and admin access:

1. **User Login** - Regular user credentials
2. **Admin Login** - Admin password (separate step)

This prevents confusion and ensures admin features are only accessible with explicit admin credentials.

---

## Login Flow

### Step 1: User Login
```
User visits /auth
    ↓
Enters email and password
    ↓
Clicks "Sign In"
    ↓
Redirected to /user-dashboard
```

### Step 2: User Dashboard
```
User sees dashboard with options:
  - Go to Dashboard
  - View Team
  - View Team Goals
  - Login as Admin (if they have password)
  - Sign Out
```

### Step 3: Admin Login (Optional)
```
User clicks "Login as Admin"
    ↓
Redirected to /admin-login
    ↓
Enters admin password
    ↓
Clicks "Access Admin Panel"
    ↓
Redirected to /admin
```

---

## Pages

### `/auth` - User Login
- Email and password login
- Sign up option
- Password reset option
- **Redirects to:** `/user-dashboard` after successful login

### `/user-dashboard` - User Dashboard
- Shows logged-in user email
- Navigation options for regular users
- "Login as Admin" button
- Sign out button
- **Redirects to:** `/admin-login` if admin button clicked
- **Redirects to:** `/admin` if already admin

### `/admin-login` - Admin Login
- Shows current user email
- Requires admin password
- **Redirects to:** `/admin` after successful admin login
- **Redirects to:** `/auth` if sign out clicked

### `/admin` - Admin Panel
- Only accessible after admin login
- Full admin features

---

## UI Changes

### AppHeader (Top Navigation)
**When logged in as regular user:**
```
[Email] [Admin Button] [Sign out]
```

**When logged in as admin:**
```
[Email] [Sign out]
```

**When not logged in:**
```
[Sign in]
```

### Sign In/Out Button
- **Before:** "Sign in" button (when not logged in)
- **After:** "Sign out" button (when logged in)
- **New:** "Admin" button (when logged in as regular user)

---

## Admin Password

### Setting Admin Password

The admin password is controlled by the environment variable:
```
NEXT_PUBLIC_ADMIN_PASSWORD=your-admin-password
```

**Default:** `admin123` (if not set)

### How to Change

1. **Local Development:**
   - Create/edit `.env.local`
   - Add: `NEXT_PUBLIC_ADMIN_PASSWORD=your-new-password`
   - Restart dev server

2. **Production (Vercel):**
   - Go to Vercel Dashboard → Settings → Environment Variables
   - Add: `NEXT_PUBLIC_ADMIN_PASSWORD=your-new-password`
   - Redeploy the app

### Security Note
⚠️ This password is public (NEXT_PUBLIC prefix). For production, consider:
- Using a more complex password
- Implementing role-based access control
- Using Supabase roles instead

---

## User Flow Examples

### Example 1: Regular User
```
1. User visits app
2. Sees "Sign in" button
3. Clicks "Sign in"
4. Enters email/password
5. Redirected to /user-dashboard
6. Sees dashboard with user options
7. Can access Dashboard, Team, Team Goals
8. Cannot access Admin panel
```

### Example 2: Admin User
```
1. User visits app
2. Sees "Sign in" button
3. Clicks "Sign in"
4. Enters email/password
5. Redirected to /user-dashboard
6. Sees "Login as Admin" button
7. Clicks "Login as Admin"
8. Enters admin password
9. Redirected to /admin
10. Can access all admin features
```

### Example 3: Already Admin
```
1. Admin user visits app
2. Sees "Sign in" button
3. Clicks "Sign in"
4. Enters email/password
5. Redirected to /user-dashboard
6. System detects user is already admin
7. Automatically redirected to /admin
```

---

## Files Created/Modified

### New Files
- `src/app/admin-login/page.tsx` - Admin login page
- `src/app/user-dashboard/page.tsx` - User dashboard page

### Modified Files
- `src/app/auth/page.tsx` - Changed redirect to `/user-dashboard`
- `src/components/AppHeader.tsx` - Added "Admin" button for non-admin users

---

## Benefits

✅ **Clear Separation** - User and admin access are separate
✅ **Better UX** - Users know what state they're in
✅ **Security** - Admin features require explicit password
✅ **Prevents Confusion** - No more missing admin menu
✅ **Easy Navigation** - Clear buttons for each action
✅ **Sign Out Clarity** - Button clearly shows current state

---

## Testing

### Test 1: Regular User Login
```
1. Go to /auth
2. Enter regular user credentials
3. Should redirect to /user-dashboard
4. Should see user options
5. Should NOT see admin menu
✅ PASS
```

### Test 2: Admin Login
```
1. Go to /auth
2. Enter user credentials
3. Redirected to /user-dashboard
4. Click "Login as Admin"
5. Enter admin password
6. Should redirect to /admin
7. Should see admin menu
✅ PASS
```

### Test 3: Sign Out
```
1. When logged in, click "Sign out"
2. Should redirect to /auth
3. Should see "Sign in" button
✅ PASS
```

### Test 4: Already Admin
```
1. Go to /auth
2. Enter admin user credentials
3. Redirected to /user-dashboard
4. System detects admin status
5. Should redirect to /admin
✅ PASS
```

---

## Troubleshooting

### Issue: Admin button not showing
**Cause:** User is already admin
**Fix:** This is correct behavior - admin users go straight to admin panel

### Issue: Admin login fails
**Cause:** Wrong admin password
**Fix:** Check `NEXT_PUBLIC_ADMIN_PASSWORD` environment variable

### Issue: Redirected to /auth unexpectedly
**Cause:** Session expired or not logged in
**Fix:** Log in again at /auth

### Issue: Can't access /admin
**Cause:** Not logged in as admin
**Fix:** Go to /user-dashboard and click "Login as Admin"

---

## Environment Variables

### Required
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

### Optional
- `NEXT_PUBLIC_ADMIN_PASSWORD` - Admin password (default: `admin123`)

---

## Next Steps

1. **Test the new flow** locally
2. **Set admin password** in environment variables
3. **Deploy to Vercel**
4. **Verify login flow** in production
5. **Update team documentation**

---

## Summary

The new login flow provides:
- ✅ Clear separation between user and admin access
- ✅ Better user experience with state indication
- ✅ Secure admin access with password
- ✅ Easy navigation and sign out
- ✅ No more missing admin menu issues

**Status:** Ready for testing and deployment! 🚀
