import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { getColombianMatches } from "@/lib/sportsdb.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Calendar, ArrowRight } from "lucide-react";
import colombiaHero from "@/assets/colombia-hero.jpg";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  const { session } = useAuth();
  const fetchCol = useServerFn(getColombianMatches);
  const { data, isLoading } = useQuery({
    queryKey: ["colombian-matches"],
    queryFn: () => fetchCol(),
    staleTime: 5 * 60 * 1000,
  });

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

      {/* Colombian league */}
      <section className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex items-end justify-between mb-6">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">En vivo</div>
            <h2 className="text-2xl sm:text-3xl font-bold">Fútbol colombiano</h2>
            <p className="text-sm text-muted-foreground mt-1">{data?.league ?? "Liga Colombiana"}</p>
          </div>
          <a href="https://www.thesportsdb.com" target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-foreground">datos: TheSportsDB</a>
        </div>

        {isLoading && <Card className="p-8 text-center text-sm text-muted-foreground">Cargando partidos…</Card>}

        {!isLoading && (
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2"><Trophy className="size-4 text-primary" /> Últimos resultados</h3>
              <div className="space-y-2">
                {(data?.past ?? []).slice(0, 6).map((m) => <MatchLine key={m.id} m={m} />)}
                {(data?.past?.length ?? 0) === 0 && (
                  <p className="text-sm text-muted-foreground">Sin resultados recientes.</p>
                )}
              </div>
            </Card>
            <Card className="p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2"><Calendar className="size-4 text-primary" /> Próximos partidos</h3>
              <div className="space-y-2">
                {(data?.upcoming ?? []).slice(0, 6).map((m) => <MatchLine key={m.id} m={m} upcoming />)}
                {(data?.upcoming?.length ?? 0) === 0 && (
                  <p className="text-sm text-muted-foreground">Sin próximos partidos programados.</p>
                )}
              </div>
            </Card>
          </div>
        )}
      </section>
    </div>
  );
}

function MatchLine({ m, upcoming }: { m: any; upcoming?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b last:border-0">
      <div className="text-[10px] text-muted-foreground w-16 shrink-0">
        {new Date(m.date + (m.time ? `T${m.time}Z` : "T12:00:00Z")).toLocaleDateString("es-CO", { day: "2-digit", month: "short" })}
      </div>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {m.homeBadge && <img src={m.homeBadge} alt="" className="size-5 rounded-sm object-contain" />}
        <span className="truncate text-sm font-medium">{m.home}</span>
      </div>
      <div className="text-sm font-mono font-semibold tabular-nums px-2">
        {upcoming ? "vs" : `${m.homeScore ?? "-"} : ${m.awayScore ?? "-"}`}
      </div>
      <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
        <span className="truncate text-sm font-medium text-right">{m.away}</span>
        {m.awayBadge && <img src={m.awayBadge} alt="" className="size-5 rounded-sm object-contain" />}
      </div>
    </div>
  );
}
