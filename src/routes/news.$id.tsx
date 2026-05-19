import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Calendar, Newspaper, Star, Building2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/common/PageCard";
import { Button } from "@/components/ui/button";
import { useNewsItem } from "@/data/newsApi";
import { useAuth } from "@/hooks/useAuth";
import { normalizeImageUrl } from "@/lib/imageUrl";
import { RouteErrorBoundary } from "@/components/layout/RouteErrorBoundary";

export const Route = createFileRoute("/news/$id")({
  component: NewsDetailPage,
  errorComponent: ({ error, reset }) => <RouteErrorBoundary title="Noticia" error={error} reset={reset} />,
});

function NewsDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const { data: n, isLoading } = useNewsItem(id);

  return (
    <AppShell title="Noticia" subtitle="Detalle">
      <div>
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate({ to: "/news" })}>
          <ArrowLeft className="h-4 w-4" /> Volver a noticias
        </Button>
      </div>

      {isLoading ? (
        <PageCard><div className="py-8 text-center text-sm text-muted-foreground">Cargando…</div></PageCard>
      ) : !n ? (
        <PageCard>
          <div className="py-10 text-center text-sm text-muted-foreground">Noticia no encontrada.</div>
        </PageCard>
      ) : (
        <article className="rounded-2xl border border-border bg-card overflow-hidden shadow-[var(--shadow-soft)]">
          <div className="aspect-[16/8] bg-muted">
            {n.image_url ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <img src={normalizeImageUrl(n.image_url)} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full grid place-items-center text-muted-foreground"><Newspaper className="h-10 w-10" /></div>
            )}
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium">{n.category}</span>
              {n.highlighted && (
                <span className="px-2 py-0.5 rounded-md bg-warning/15 text-warning-foreground font-medium inline-flex items-center gap-1">
                  <Star className="h-3 w-3" /> Destacada
                </span>
              )}
              <span className={`px-2 py-0.5 rounded-md font-medium ${n.status === "Published" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                {n.status === "Published" ? "Publicada" : "Borrador"}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{n.title}</h1>
            <div className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {new Date(n.event_date ?? n.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}
            </div>
            <div className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground/90">
              {n.description}
            </div>
            {n.property && (
              <Link
                to="/properties/$id"
                params={{ id: n.property.id }}
                className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3 hover:bg-muted/60 transition-colors"
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">Propiedad relacionada</div>
                  <div className="font-medium truncate">{n.property.code} · {n.property.title}</div>
                </div>
                <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
              </Link>
            )}
            {isAdmin && (
              <div className="pt-2 text-xs text-muted-foreground">
                Para editar o eliminar, vuelve al listado.
              </div>
            )}
          </div>
        </article>
      )}
    </AppShell>
  );
}
