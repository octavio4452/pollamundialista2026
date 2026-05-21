import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, ArrowRight } from "lucide-react";
import colombiaHero from "@/assets/colombia-hero.jpg";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  const { session } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["wc-group-fixture"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("id, group_name, kickoff, home_score, away_score, finished, home:home_team_id(name,flag_emoji), away:away_team_id(name,flag_emoji)")
        .eq("stage", "group")
        .order("group_name", { ascending: true })
        .order("kickoff", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const groups = (data ?? []).reduce<Record<string, any[]>>((acc, m: any) => {
    const g = m.group_name || "—";
    (acc[g] ||= []).push(m);
    return acc;
  }, {});
  const groupKeys = Object.keys(groups).sort();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        <img
          src={colombiaHero}
          alt="Selección Colombia celebrando"
          width={1920}
          height={1080}
          className="absolute inset-0 w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/85 to-background" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.2),transparent_60%)]" />
        <div className="relative max-w-5xl mx-auto px-6 py-16 sm:py-24">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-5">
            <Trophy className="size-3.5" /> Mundial 2026
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight">
            Polla Mundialista <span className="text-primary">2026</span>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
            Predice resultados, equipos que avanzan, finalistas, campeón y goleador.
            Compite con tus amigos y mira en vivo la asignación de puntos.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to={session ? "/dashboard" : "/login"}>
                {session ? "Ir al dashboard" : "Iniciar sesión"} <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>

          {/* Scoring rules */}
          <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl">
            {[
              { p: 1, l: "Resultado grupo" },
              { p: 2, l: "Avanza de grupos" },
              { p: 4, l: "Octavos" },
              { p: 8, l: "Cuartos" },
              { p: 12, l: "Semifinal" },
              { p: 20, l: "Finalistas" },
              { p: 30, l: "Campeón" },
              { p: 15, l: "Goleador" },
            ].map((r) => (
              <div key={r.l} className="rounded-lg border bg-card p-3">
                <div className="text-2xl font-bold text-primary">{r.p}</div>
                <div className="text-xs text-muted-foreground">{r.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* World Cup fixture by groups */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-6">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Fixture</div>
          <h2 className="text-2xl sm:text-3xl font-bold">Mundial 2026 — Fase de grupos</h2>
          <p className="text-sm text-muted-foreground mt-1">Todos los partidos agrupados por grupo.</p>
        </div>

        {isLoading && <Card className="p-8 text-center text-sm text-muted-foreground">Cargando partidos…</Card>}

        {!isLoading && groupKeys.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">Aún no hay partidos cargados.</Card>
        )}

        {!isLoading && groupKeys.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groupKeys.map((g) => (
              <Card key={g} className="p-5">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Trophy className="size-4 text-primary" /> Grupo {g}
                </h3>
                <div className="space-y-1">
                  {groups[g].map((m) => <GroupMatchLine key={m.id} m={m} />)}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function GroupMatchLine({ m }: { m: any }) {
  const kickoff = new Date(m.kickoff);
  const showScore = m.finished && m.home_score != null && m.away_score != null;
  return (
    <div className="flex items-center gap-2 py-1.5 border-b last:border-0 text-sm">
      <div className="text-[10px] text-muted-foreground w-12 shrink-0">
        {kickoff.toLocaleDateString("es-CO", { day: "2-digit", month: "short" })}
      </div>
      <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
        <span className="truncate font-medium text-right">{m.home?.name}</span>
        <span>{m.home?.flag_emoji}</span>
      </div>
      <div className="font-mono font-semibold tabular-nums px-1 text-xs">
        {showScore ? `${m.home_score}-${m.away_score}` : "vs"}
      </div>
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <span>{m.away?.flag_emoji}</span>
        <span className="truncate font-medium">{m.away?.name}</span>
      </div>
    </div>
  );
}
