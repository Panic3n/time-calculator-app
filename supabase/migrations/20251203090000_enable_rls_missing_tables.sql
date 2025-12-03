-- Enable RLS on tables reported by linter
ALTER TABLE IF EXISTS public.employee_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.team_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.message_board ENABLE ROW LEVEL SECURITY;

-- Add policies for employee_feedback
DROP POLICY IF EXISTS employee_feedback_all_authenticated ON public.employee_feedback;
CREATE POLICY employee_feedback_all_authenticated ON public.employee_feedback
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add policies for team_goals
DROP POLICY IF EXISTS team_goals_all_authenticated ON public.team_goals;
CREATE POLICY team_goals_all_authenticated ON public.team_goals
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add policies for message_board
DROP POLICY IF EXISTS message_board_all_authenticated ON public.message_board;
CREATE POLICY message_board_all_authenticated ON public.message_board
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
