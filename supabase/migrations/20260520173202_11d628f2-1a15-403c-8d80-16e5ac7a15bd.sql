
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS predictions_locked_at timestamptz;

CREATE OR REPLACE FUNCTION public.predictions_locked(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _uid AND predictions_locked_at IS NOT NULL)
$$;

-- match_predictions
DROP POLICY IF EXISTS "Insert own predictions" ON public.match_predictions;
DROP POLICY IF EXISTS "Update own predictions before match" ON public.match_predictions;
DROP POLICY IF EXISTS "Delete own predictions" ON public.match_predictions;

CREATE POLICY "Insert own predictions" ON public.match_predictions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND NOT public.predictions_locked(auth.uid()));

CREATE POLICY "Update own predictions before match" ON public.match_predictions
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND NOT public.predictions_locked(auth.uid())
    AND EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_predictions.match_id AND m.kickoff > now() AND NOT m.finished)
  );

CREATE POLICY "Delete own predictions" ON public.match_predictions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND NOT public.predictions_locked(auth.uid()));

-- bracket_predictions
DROP POLICY IF EXISTS "Manage own bracket" ON public.bracket_predictions;

CREATE POLICY "View own bracket" ON public.bracket_predictions
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "Insert own bracket" ON public.bracket_predictions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND NOT public.predictions_locked(auth.uid()));

CREATE POLICY "Update own bracket" ON public.bracket_predictions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND NOT public.predictions_locked(auth.uid()))
  WITH CHECK (user_id = auth.uid() AND NOT public.predictions_locked(auth.uid()));

CREATE POLICY "Delete own bracket" ON public.bracket_predictions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND NOT public.predictions_locked(auth.uid()));

-- top_scorer_predictions
DROP POLICY IF EXISTS "Manage own scorer" ON public.top_scorer_predictions;

CREATE POLICY "View own scorer" ON public.top_scorer_predictions
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "Insert own scorer" ON public.top_scorer_predictions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND NOT public.predictions_locked(auth.uid()));

CREATE POLICY "Update own scorer" ON public.top_scorer_predictions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND NOT public.predictions_locked(auth.uid()))
  WITH CHECK (user_id = auth.uid() AND NOT public.predictions_locked(auth.uid()));

CREATE POLICY "Delete own scorer" ON public.top_scorer_predictions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND NOT public.predictions_locked(auth.uid()));
