import { createFileRoute } from "@tanstack/react-router";
import { PublicCard, downloadVCard } from "@/components/profile/PublicCard";
import { usePublicProfile } from "@/data/profileApi";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export const Route = createFileRoute("/p/$id")({
  component: PublicCardPage,
});

const BASE_URL = "https://app.salgon.com";

function PublicCardPage() {
  const { id } = Route.useParams();
  const { data: profile, isLoading } = usePublicProfile(id);

  if (isLoading) {
    return (
      <div className="min-h-screen grid place-items-center bg-gray-50">
        <div className="animate-pulse text-sm text-gray-400">Cargando…</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen grid place-items-center bg-gray-50 px-4">
        <div className="text-center">
          <div className="text-4xl mb-4">🏠</div>
          <h1 className="text-xl font-semibold text-gray-800 mb-2">Perfil no encontrado</h1>
          <p className="text-sm text-gray-500">Este enlace no corresponde a ningún agente.</p>
        </div>
      </div>
    );
  }

  const publicUrl = `${BASE_URL}/p/${id}`;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-8 gap-4">
      <PublicCard profile={profile} publicUrl={publicUrl} />
      <Button variant="outline" className="gap-2 w-full max-w-sm" onClick={() => downloadVCard(profile)}>
        <Download className="h-4 w-4" />
        Guardar contacto
      </Button>
      <p className="text-xs text-gray-400 text-center">
        Compartir: <span className="font-mono">{publicUrl}</span>
      </p>
    </div>
  );
}
