-- Link a Supabase Auth User to an Employee Profile
-- Run this in your Supabase SQL Editor

DO $$
DECLARE
  -- 1. Set the email of the user to link
  user_email text := 'konny.larsson@stjarnafyrkant.se';
  
  -- 2. Set the name of the employee (must match 'employees' table)
  employee_name text := 'Konny Larsson';
  
  target_user_id uuid;
  target_employee_id uuid;
BEGIN
  -- Find User
  SELECT id INTO target_user_id FROM auth.users WHERE email = user_email;
  
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found. Have they signed up?', user_email;
  END IF;

  -- Find Employee
  SELECT id INTO target_employee_id FROM public.employees WHERE name ILIKE employee_name || '%' LIMIT 1;
  
  IF target_employee_id IS NULL THEN
    RAISE EXCEPTION 'Employee with name % not found in public.employees table.', employee_name;
  END IF;

  -- Create or Update Profile
  -- Note: app_profiles requires email
  INSERT INTO public.app_profiles (user_id, employee_id, email)
  VALUES (target_user_id, target_employee_id, user_email)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    employee_id = EXCLUDED.employee_id,
    email = EXCLUDED.email;
  
  RAISE NOTICE 'Successfully linked User % (%) to Employee % (%)', user_email, target_user_id, employee_name, target_employee_id;
END $$;
