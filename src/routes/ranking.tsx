import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { getPublicRanking } from "@/lib/ranking.functions";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Medal, Award, ArrowLeft, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/ranking")({
  component: RankingPage,
  errorComponent: ({ error }: { error: Error }) => (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">Error al cargar el ranking</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">Ranking no encontrado</h1>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  ),
});

function RankingPage() {
  const { session } = useAuth();
  const fetchRanking = useServerFn(getPublicRanking);
  const { data: scores = [], isLoading } = useQuery({
    queryKey: ["public-ranking"],
    queryFn: () => fetchRanking(),
  });

  const rankIcon = (i: number) => {
    if (i === 0) return <Trophy className="size-5 text-accent" />;
    if (i === 1) return <Medal className="size-5 text-muted-foreground" />;
    if (i === 2) return <Award className="size-5 text-muted-foreground/70" />;
    return <span className="text-sm text-muted-foreground w-5 text-center">{i + 1}</span>;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Simple public header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-foreground hover:text-primary transition-colors">
            <Trophy className="size-5 text-primary" />
            <span>Polla Mundialista 2026</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/">
                <ArrowLeft className="size-4 mr-1" /> Inicio
              </Link>
            </Button>
            {!session && (
              <Button size="sm" asChild>
                <Link to="/login">
                  Iniciar sesión <ArrowRight className="size-4 ml-1" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Tabla de posiciones</h1>
          <p className="text-muted-foreground mt-1">Puntos acumulados de cada participante.</p>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left py-3 px-4 w-12">#</th>
                  <th className="text-left py-3 px-4">Participante</th>
                  <th className="text-right py-3 px-4">Partidos</th>
                  <th className="text-right py-3 px-4">Llaves</th>
                  <th className="text-right py-3 px-4">Goleador</th>
                  <th className="text-right py-3 px-4">Total</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">Cargando…</td>
                  </tr>
                ) : scores.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">Sin participantes aún.</td>
                  </tr>
                ) : (
                  scores.map((s, i: number) => (
                    <tr key={s.user_id} className="border-t hover:bg-muted/30">
                      <td className="py-3 px-4">{rankIcon(i)}</td>
                      <td className="py-3 px-4 font-medium">{s.full_name}</td>
                      <td className="py-3 px-4 text-right">{s.match_points}</td>
                      <td className="py-3 px-4 text-right">{s.bracket_points}</td>
                      <td className="py-3 px-4 text-right">{s.scorer_points}</td>
                      <td className="py-3 px-4 text-right font-bold text-primary">{s.total_points}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold mb-3">Reglas de puntuación</h2>
          <ul className="text-sm text-muted-foreground space-y-1.5">
            <li>• <b className="text-foreground">1 pt</b> — acertar resultado (gana, empate) en fase de grupos</li>
            <li>• <b className="text-foreground">2 pts c/u</b> — equipos que avanzan por grupos</li>
            <li>• <b className="text-foreground">4 pts c/u</b> — equipos que llegan a octavos</li>
            <li>• <b className="text-foreground">8 pts c/u</b> — equipos que llegan a cuartos</li>
            <li>• <b className="text-foreground">12 pts c/u</b> — equipos que llegan a semifinal</li>
            <li>• <b className="text-foreground">20 pts c/u</b> — finalistas</li>
            <li>• <b className="text-foreground">30 pts</b> — campeón</li>
            <li>• <b className="text-foreground">15 pts</b> — goleador del torneo</li>
          </ul>
        </Card>
      </main>
    </div>
  );
}
