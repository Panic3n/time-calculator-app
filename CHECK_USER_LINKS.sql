-- Check all users and their linked employee profiles
-- Run this in Supabase SQL Editor

SELECT 
  u.email as user_email,
  CASE WHEN p.employee_id IS NOT NULL THEN '✅ LINKED' ELSE '❌ NOT LINKED' END as status,
  e.name as linked_employee_name,
  -- Fuzzy match suggestion based on email prefix (Firstname.Lastname)
  (
    SELECT name 
    FROM public.employees 
    WHERE name ILIKE replace(split_part(u.email, '@', 1), '.', ' ') || '%' 
    LIMIT 1
  ) as suggested_match_by_email
FROM auth.users u
LEFT JOIN public.app_profiles p ON u.id = p.user_id
LEFT JOIN public.employees e ON p.employee_id = e.id
ORDER BY status ASC, u.email;
