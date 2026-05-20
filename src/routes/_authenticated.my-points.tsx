import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/my-points")({ component: MyPoints });

const CAT_LABEL: Record<string, string> = {
  group_advance: "Avance de grupos (2 pts)",
  round_of_16: "Octavos (4 pts)",
  quarter_final: "Cuartos (8 pts)",
  semi_final: "Semifinal (12 pts)",
  final: "Finalista (20 pts)",
  champion: "Campeón (30 pts)",
};

function MyPoints() {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ["my-points", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [mp, bp, ts, settings] = await Promise.all([
        supabase
          .from("match_predictions")
          .select("id, predicted_outcome, points_awarded, match:matches(id, kickoff, stage, home_score, away_score, home:home_team_id(name, code), away:away_team_id(name, code))")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("bracket_predictions")
          .select("id, category, points_awarded, team:teams(name, code, flag_emoji)")
          .eq("user_id", user!.id),
        supabase.from("top_scorer_predictions").select("*").eq("user_id", user!.id).maybeSingle(),
        supabase.from("tournament_settings").select("*").eq("id", 1).maybeSingle(),
      ]);
      const { data: profile } = await supabase
        .from("profiles")
        .select("predictions_locked_at")
        .eq("id", user!.id)
        .maybeSingle();
      return {
        matches: mp.data ?? [],
        bracket: bp.data ?? [],
        scorer: ts.data,
        settings: settings.data,
        locked: !!profile?.predictions_locked_at,
      };
    },
  });

  const matches = data?.matches ?? [];
  const bracket = data?.bracket ?? [];
  const bracketByCat = bracket.reduce((acc: Record<string, any[]>, r: any) => {
    (acc[r.category] ||= []).push(r);
    return acc;
  }, {});

  const total =
    matches.reduce((s, m: any) => s + (m.points_awarded || 0), 0) +
    bracket.reduce((s, b: any) => s + (b.points_awarded || 0), 0) +
    (data?.scorer?.points_awarded || 0);

  const locked = data?.locked ?? false;

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold">Mis puntos</h1>
          <p className="text-muted-foreground mt-1">Detalle de cómo se asignaron tus puntos.</p>
        </div>
        <div className="text-right">
          <div className="text-4xl font-bold text-primary">{total}</div>
          <div className="text-xs text-muted-foreground">puntos totales</div>
        </div>
      </div>

      {!locked && (
        <Card className="p-4 border-amber-500/50 bg-amber-500/10">
          <div className="flex gap-3">
            <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-amber-700 dark:text-amber-400">
                No has realizado el envío final de tus pronósticos
              </p>
              <p className="text-muted-foreground mt-1">
                Mientras no envíes definitivamente tus pronósticos, <b>no se te asignarán puntos</b> aunque tus predicciones sean correctas. Ve a "Mis pronósticos" y completa el envío final.
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-5">
        <h2 className="font-semibold mb-4">Pronósticos de partidos</h2>
        {matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no tienes pronósticos.</p>
        ) : (
          <div className="space-y-2">
            {matches.map((m: any) => {
              const finished = m.match.home_score !== null;
              const outcomeLabel =
                m.predicted_outcome === "home" ? m.match.home?.name :
                m.predicted_outcome === "away" ? m.match.away?.name : "Empate";
              return (
                <div key={m.id} className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
                  <div className="text-sm">
                    <span className="font-medium">{m.match.home?.code} vs {m.match.away?.code}</span>
                    <span className="text-muted-foreground ml-2">
                      {finished ? `(${m.match.home_score}-${m.match.away_score})` : "(pendiente)"}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">Tu: {outcomeLabel}</div>
                  <Badge variant={m.points_awarded > 0 ? "default" : "secondary"}>
                    {m.points_awarded} pt
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold mb-4">Llaves y avances</h2>
        {bracket.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no tienes pronósticos de llaves.</p>
        ) : (
          <div className="space-y-4">
            {Object.keys(CAT_LABEL).map((cat) => {
              const items = bracketByCat[cat] || [];
              if (items.length === 0) return null;
              return (
                <div key={cat}>
                  <h3 className="text-sm font-medium mb-2">{CAT_LABEL[cat]}</h3>
                  <div className="flex flex-wrap gap-2">
                    {items.map((it: any) => (
                      <Badge key={it.id} variant={it.points_awarded > 0 ? "default" : "secondary"}>
                        {it.team?.flag_emoji} {it.team?.name} · {it.points_awarded} pt
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold mb-2">Goleador (15 pts)</h2>
        {data?.scorer ? (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm">Tu pronóstico: <b>{data.scorer.player_name}</b></div>
              {data.settings?.actual_top_scorer && (
                <div className="text-xs text-muted-foreground mt-1">
                  Goleador oficial: {data.settings.actual_top_scorer}
                </div>
              )}
            </div>
            <Badge variant={data.scorer.points_awarded > 0 ? "default" : "secondary"}>
              {data.scorer.points_awarded} pt
            </Badge>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No has registrado un goleador.</p>
        )}
      </Card>
    </div>
  );
}