import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Trophy, LogOut, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({ component: Layout });

function Layout() {
  const { session, loading, isAdmin, signOut, user } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login", replace: true });
  }, [session, loading, navigate]);

  if (loading || !session) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Cargando…</div>;
  }

  const link = (to: string, label: string) => {
    const active = loc.pathname === to || (to !== "/dashboard" && loc.pathname.startsWith(to));
    return (
      <Link
        to={to}
        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          active ? "bg-primary text-primary-foreground" : "text-foreground/70 hover:text-foreground hover:bg-muted"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <Link to="/dashboard" className="flex items-center gap-2 font-bold">
            <Trophy className="size-5 text-primary" />
            <span>Polla Mundialista 2026</span>
          </Link>
          <nav className="flex items-center gap-1 flex-1 justify-center flex-wrap">
            {link("/dashboard", "Ranking")}
            {link("/predictions", "Mis pronósticos")}
            {link("/my-points", "Mis puntos")}
            {isAdmin && link("/admin", "Admin")}
          </nav>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <span className="hidden sm:inline-flex items-center gap-1 text-xs text-primary">
                <ShieldCheck className="size-3.5" /> admin
              </span>
            )}
            <span className="hidden md:inline text-xs text-muted-foreground">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}