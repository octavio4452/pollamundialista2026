
-- Match points: only award if user locked predictions
CREATE OR REPLACE FUNCTION public.recalc_match_points()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_outcome match_outcome;
BEGIN
  IF NEW.finished AND NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL THEN
    v_outcome := CASE
      WHEN NEW.home_score > NEW.away_score THEN 'home'::match_outcome
      WHEN NEW.home_score < NEW.away_score THEN 'away'::match_outcome
      ELSE 'draw'::match_outcome
    END;
    UPDATE public.match_predictions mp
      SET points_awarded = CASE
            WHEN mp.predicted_outcome = v_outcome
             AND NEW.stage = 'group'
             AND public.predictions_locked(mp.user_id)
            THEN 1 ELSE 0 END,
          updated_at = now()
      WHERE mp.match_id = NEW.id;
  ELSE
    UPDATE public.match_predictions SET points_awarded = 0, updated_at = now() WHERE match_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;

-- Bracket points: only award if user locked predictions
CREATE OR REPLACE FUNCTION public.recalc_bracket_points()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cat bracket_category;
BEGIN
  v_cat := COALESCE(NEW.category, OLD.category);
  UPDATE public.bracket_predictions bp
    SET points_awarded = CASE
      WHEN EXISTS (SELECT 1 FROM public.bracket_results br WHERE br.category = bp.category AND br.team_id = bp.team_id)
       AND public.predictions_locked(bp.user_id)
      THEN public.bracket_points(bp.category)
      ELSE 0 END
    WHERE bp.category = v_cat;
  RETURN NEW;
END;
$function$;

-- Top scorer points: only award if user locked predictions
CREATE OR REPLACE FUNCTION public.recalc_top_scorer_points()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.top_scorer_predictions tsp
    SET points_awarded = CASE
      WHEN NEW.actual_top_scorer IS NOT NULL
       AND lower(trim(tsp.player_name)) = lower(trim(NEW.actual_top_scorer))
       AND public.predictions_locked(tsp.user_id)
      THEN 15 ELSE 0 END,
      updated_at = now();
  RETURN NEW;
END;
$function$;

-- Recalculate existing points for already-finished matches / results
UPDATE public.match_predictions mp
  SET points_awarded = CASE
    WHEN public.predictions_locked(mp.user_id)
     AND EXISTS (
       SELECT 1 FROM public.matches m
       WHERE m.id = mp.match_id
         AND m.finished
         AND m.stage = 'group'
         AND ((m.home_score > m.away_score AND mp.predicted_outcome = 'home')
           OR (m.home_score < m.away_score AND mp.predicted_outcome = 'away')
           OR (m.home_score = m.away_score AND mp.predicted_outcome = 'draw')))
    THEN 1 ELSE 0 END,
    updated_at = now();

UPDATE public.bracket_predictions bp
  SET points_awarded = CASE
    WHEN public.predictions_locked(bp.user_id)
     AND EXISTS (SELECT 1 FROM public.bracket_results br WHERE br.category = bp.category AND br.team_id = bp.team_id)
    THEN public.bracket_points(bp.category) ELSE 0 END;

UPDATE public.top_scorer_predictions tsp
  SET points_awarded = CASE
    WHEN public.predictions_locked(tsp.user_id)
     AND EXISTS (SELECT 1 FROM public.tournament_settings s
       WHERE s.actual_top_scorer IS NOT NULL
         AND lower(trim(tsp.player_name)) = lower(trim(s.actual_top_scorer)))
    THEN 15 ELSE 0 END,
    updated_at = now();
