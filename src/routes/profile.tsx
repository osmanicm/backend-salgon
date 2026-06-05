import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/common/PageCard";
import { Button } from "@/components/ui/button";
import { ExternalLink, Copy } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/data/profileApi";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { toast } from "sonner";
import { RouteErrorBoundary } from "@/components/layout/RouteErrorBoundary";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
  errorComponent: ({ error, reset }) => (
    <RouteErrorBoundary title="Mi Perfil" error={error} reset={reset} />
  ),
});

const BASE_URL = "https://app.salgon.com";

function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: profile, isLoading } = useProfile(user?.id);

  if (!user) {
    navigate({ to: "/auth" });
    return null;
  }

  const publicUrl = `${BASE_URL}/p/${user.id}`;

  function copyLink() {
    navigator.clipboard.writeText(publicUrl).then(() => toast.success("Enlace copiado"));
  }

  return (
    <AppShell title="Mi Perfil" subtitle="Edita tu información y tarjeta digital">
      <PageCard
        title="Mi Perfil"
        description="Tu información pública como agente Salgon"
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={copyLink}>
              <Copy className="h-3.5 w-3.5" /> Copiar enlace
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" asChild>
              <a href={publicUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" /> Ver tarjeta
              </a>
            </Button>
          </div>
        }
      >
        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Cargando perfil…</div>
        ) : profile ? (
          <ProfileForm profile={profile} publicUrl={publicUrl} />
        ) : (
          <div className="py-12 text-center text-sm text-muted-foreground">No se encontró tu perfil.</div>
        )}
      </PageCard>
    </AppShell>
  );
}
