# Admin Login - Quick Guide

## 🚀 Quick Start

### For Users
1. Go to app
2. Click **"Sign in"**
3. Enter email & password
4. You're on the **User Dashboard**
5. Click **"Sign out"** to logout

### For Admins
1. Go to app
2. Click **"Sign in"**
3. Enter email & password
4. Click **"Login as Admin"** button
5. Enter admin password
6. You're in the **Admin Panel**
7. Click **"Sign out"** to logout

---

## 🎯 What Changed

### Before
```
Sign in → Home → Sometimes admin menu visible
```

### After
```
Sign in → User Dashboard → Admin Login (optional) → Admin Panel
```

---

## 🔘 Buttons

### Header (Top Right)

**Not Logged In:**
```
[Sign in]
```

**Logged In (Regular User):**
```
[email] [Admin] [Sign out]
```

**Logged In (Admin):**
```
[email] [Sign out]
```

---

## 📄 Pages

| Page | URL | Purpose |
|------|-----|---------|
| Login | `/auth` | User email/password login |
| User Dashboard | `/user-dashboard` | User options after login |
| Admin Login | `/admin-login` | Admin password entry |
| Admin Panel | `/admin` | Admin features |

---

## 🔐 Admin Password

**Default:** `admin123`

**To Change:**
- Local: Add to `.env.local`
  ```
  NEXT_PUBLIC_ADMIN_PASSWORD=your-password
  ```
- Production: Add to Vercel environment variables

---

## ✅ Testing

### Test 1: Regular User
```
1. Sign in with regular user
2. Should see User Dashboard
3. Should see "Admin" button
4. Should NOT see admin menu
✅ PASS
```

### Test 2: Admin User
```
1. Sign in with user credentials
2. Click "Admin" button
3. Enter admin password
4. Should see Admin Panel
✅ PASS
```

### Test 3: Sign Out
```
1. Click "Sign out"
2. Should go back to login
✅ PASS
```

---

## 🎨 User Experience Flow

```
┌─────────────────────────────────────────────────────┐
│                    START                            │
└────────────────────┬────────────────────────────────┘
                     │
                     ↓
            ┌────────────────┐
            │   Sign in      │
            │  /auth page    │
            └────────┬───────┘
                     │
                     ↓
        ┌────────────────────────┐
        │  User Dashboard        │
        │  /user-dashboard page  │
        └────┬──────────────┬────┘
             │              │
             ↓              ↓
        ┌─────────┐    ┌──────────────┐
        │ Regular │    │ Admin Login  │
        │ Features│    │ /admin-login │
        └─────────┘    └──────┬───────┘
                              │
                              ↓
                        ┌──────────────┐
                        │ Admin Panel  │
                        │ /admin page  │
                        └──────────────┘
```

---

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| Can't see "Admin" button | You're already admin or not logged in |
| Admin login fails | Wrong password or not set in env vars |
| Redirected to login | Session expired, log in again |
| Can't access /admin | Log in as admin first |

---

## 📋 Checklist

- [ ] Test regular user login
- [ ] Test admin login
- [ ] Test sign out
- [ ] Verify "Admin" button shows
- [ ] Verify "Sign out" button shows
- [ ] Set admin password in env vars
- [ ] Deploy to Vercel
- [ ] Test in production

---

## 🎯 Key Points

✅ **Two-step login** - User first, then admin
✅ **Clear buttons** - Know what state you're in
✅ **Sign out** - Button shows you're logged in
✅ **Admin button** - Easy access to admin login
✅ **Secure** - Admin requires password

---

## 📞 Need Help?

See full documentation:
- `ADMIN_LOGIN_FLOW.md` - Complete guide
- `ADMIN_LOGIN_SUMMARY.md` - Detailed summary

---

**Ready to go!** 🚀
