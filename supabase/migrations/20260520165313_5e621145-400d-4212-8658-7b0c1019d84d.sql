
-- =========================
-- ROLES
-- =========================
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- Trigger: crear profile + rol 'user' al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================
-- EQUIPOS Y PARTIDOS
-- =========================
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL,
  group_name TEXT NOT NULL,
  flag_emoji TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE TYPE public.match_stage AS ENUM (
  'group', 'round_of_32', 'round_of_16', 'quarter_final', 'semi_final', 'final', 'third_place'
);

CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage match_stage NOT NULL DEFAULT 'group',
  group_name TEXT,
  home_team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  away_team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  kickoff TIMESTAMPTZ NOT NULL,
  home_score INT,
  away_score INT,
  finished BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- =========================
-- PREDICCIONES
-- =========================
-- 1) Predicción de partido (ganador / empate)
CREATE TYPE public.match_outcome AS ENUM ('home', 'draw', 'away');

CREATE TABLE public.match_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  predicted_outcome match_outcome NOT NULL,
  points_awarded INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, match_id)
);
ALTER TABLE public.match_predictions ENABLE ROW LEVEL SECURITY;

-- 2) Predicciones de avance por fases (grupos, octavos, cuartos, semis, finalistas, campeón)
CREATE TYPE public.bracket_category AS ENUM (
  'group_advance',   -- 2 pts c/u (los 2 que pasan de cada grupo)
  'round_of_16',     -- 4 pts c/u
  'quarter_final',   -- 8 pts c/u
  'semi_final',      -- 12 pts c/u
  'final',           -- 20 pts c/u
  'champion'         -- 30 pts
);

CREATE TABLE public.bracket_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category bracket_category NOT NULL,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  points_awarded INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, category, team_id)
);
ALTER TABLE public.bracket_predictions ENABLE ROW LEVEL SECURITY;

-- 3) Resultados reales del bracket (admin ingresa qué equipos pasaron a cada fase)
CREATE TABLE public.bracket_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category bracket_category NOT NULL,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(category, team_id)
);
ALTER TABLE public.bracket_results ENABLE ROW LEVEL SECURITY;

-- 4) Goleador
CREATE TABLE public.top_scorer_predictions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  points_awarded INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.top_scorer_predictions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tournament_settings (
  id INT PRIMARY KEY DEFAULT 1,
  actual_top_scorer TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);
INSERT INTO public.tournament_settings (id) VALUES (1);
ALTER TABLE public.tournament_settings ENABLE ROW LEVEL SECURITY;

-- =========================
-- POLÍTICAS RLS
-- =========================
-- profiles
CREATE POLICY "Profiles visible to authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Admin manage profiles" ON public.profiles FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- user_roles
CREATE POLICY "Roles visible to authenticated" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- teams
CREATE POLICY "Teams readable" ON public.teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage teams" ON public.teams FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- matches
CREATE POLICY "Matches readable" ON public.matches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage matches" ON public.matches FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- match_predictions
CREATE POLICY "View own predictions or admin" ON public.match_predictions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Insert own predictions" ON public.match_predictions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Update own predictions before match" ON public.match_predictions FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.matches m WHERE m.id = match_id AND m.kickoff > now() AND NOT m.finished
  ));
CREATE POLICY "Delete own predictions" ON public.match_predictions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- bracket_predictions
CREATE POLICY "View own bracket or admin" ON public.bracket_predictions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Manage own bracket" ON public.bracket_predictions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- bracket_results
CREATE POLICY "Bracket results readable" ON public.bracket_results FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage bracket results" ON public.bracket_results FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- top_scorer
CREATE POLICY "View own scorer or admin" ON public.top_scorer_predictions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Manage own scorer" ON public.top_scorer_predictions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- tournament_settings
CREATE POLICY "Settings readable" ON public.tournament_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage settings" ON public.tournament_settings FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- =========================
-- LÓGICA DE PUNTOS
-- =========================
-- Puntos por categoría de bracket
CREATE OR REPLACE FUNCTION public.bracket_points(_cat bracket_category)
RETURNS INT LANGUAGE SQL IMMUTABLE AS $$
  SELECT CASE _cat
    WHEN 'group_advance'  THEN 2
    WHEN 'round_of_16'    THEN 4
    WHEN 'quarter_final'  THEN 8
    WHEN 'semi_final'     THEN 12
    WHEN 'final'          THEN 20
    WHEN 'champion'       THEN 30
  END
$$;

-- Recalcular puntos de un partido cuando cambia el resultado
CREATE OR REPLACE FUNCTION public.recalc_match_points()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_outcome match_outcome;
BEGIN
  IF NEW.finished AND NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL THEN
    v_outcome := CASE
      WHEN NEW.home_score > NEW.away_score THEN 'home'::match_outcome
      WHEN NEW.home_score < NEW.away_score THEN 'away'::match_outcome
      ELSE 'draw'::match_outcome
    END;
    UPDATE public.match_predictions
      SET points_awarded = CASE WHEN predicted_outcome = v_outcome AND NEW.stage = 'group' THEN 1 ELSE 0 END,
          updated_at = now()
      WHERE match_id = NEW.id;
  ELSE
    UPDATE public.match_predictions SET points_awarded = 0, updated_at = now() WHERE match_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_recalc_match_points
AFTER INSERT OR UPDATE OF home_score, away_score, finished, stage ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.recalc_match_points();

-- Recalcular puntos de bracket cuando cambian los resultados oficiales
CREATE OR REPLACE FUNCTION public.recalc_bracket_points()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cat bracket_category;
BEGIN
  v_cat := COALESCE(NEW.category, OLD.category);
  UPDATE public.bracket_predictions bp
    SET points_awarded = CASE
      WHEN EXISTS (SELECT 1 FROM public.bracket_results br WHERE br.category = bp.category AND br.team_id = bp.team_id)
      THEN public.bracket_points(bp.category)
      ELSE 0 END
    WHERE bp.category = v_cat;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_recalc_bracket_points
AFTER INSERT OR DELETE OR UPDATE ON public.bracket_results
FOR EACH ROW EXECUTE FUNCTION public.recalc_bracket_points();

-- Recalcular puntos de goleador
CREATE OR REPLACE FUNCTION public.recalc_top_scorer_points()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.top_scorer_predictions
    SET points_awarded = CASE
      WHEN NEW.actual_top_scorer IS NOT NULL
       AND lower(trim(player_name)) = lower(trim(NEW.actual_top_scorer))
      THEN 15 ELSE 0 END,
      updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_recalc_top_scorer
AFTER UPDATE OF actual_top_scorer ON public.tournament_settings
FOR EACH ROW EXECUTE FUNCTION public.recalc_top_scorer_points();

-- Vista de ranking
CREATE OR REPLACE VIEW public.user_scores AS
SELECT
  p.id AS user_id,
  p.full_name,
  COALESCE((SELECT SUM(points_awarded) FROM public.match_predictions WHERE user_id = p.id), 0) AS match_points,
  COALESCE((SELECT SUM(points_awarded) FROM public.bracket_predictions WHERE user_id = p.id), 0) AS bracket_points,
  COALESCE((SELECT points_awarded FROM public.top_scorer_predictions WHERE user_id = p.id), 0) AS scorer_points,
  COALESCE((SELECT SUM(points_awarded) FROM public.match_predictions WHERE user_id = p.id), 0)
  + COALESCE((SELECT SUM(points_awarded) FROM public.bracket_predictions WHERE user_id = p.id), 0)
  + COALESCE((SELECT points_awarded FROM public.top_scorer_predictions WHERE user_id = p.id), 0) AS total_points
FROM public.profiles p;

GRANT SELECT ON public.user_scores TO authenticated;
