import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchPublicEvent } from "@/data/publicEventsApi";
import { checkInByEmail, type CheckinResult } from "@/utils/eventCheckin.functions";

/**
 * Respaldo del QR impreso que se pega en la puerta: quien llegue sin su pase
 * escribe su correo y registra su entrada. No lista inscritos — solo confirma
 * o niega el correo que se teclea.
 */
export const Route = createFileRoute("/e_/$id/checkin")({
  loader: async ({ params }) => ({ event: await fetchPublicEvent(params.id) }),
  head: () => ({
    meta: [{ title: "Registro de entrada · Inmobiliaria Salgon" }, { name: "robots", content: "noindex" }],
  }),
  component: SelfCheckinPage,
});

const emailSchema = z.string().trim().email("Escribe un correo válido").max(255);

function SelfCheckinPage() {
  const { id } = Route.useParams();
  const { event } = Route.useLoaderData();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckinResult | null>(null);

  if (!event) {
    return (
      <div className="min-h-screen grid place-items-center bg-gray-50 px-4">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">🎟️</div>
          <h1 className="text-xl font-semibold text-gray-800 mb-2">Evento no disponible</h1>
          <p className="text-sm text-gray-500">Este código no corresponde a ningún evento publicado.</p>
        </div>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await checkInByEmail({ data: { event_id: id, email: parsed.data } });
      if (res.reason === "not_found") {
        setError("No encontramos una inscripción con ese correo para este evento.");
      } else if (res.reason === "pending") {
        setError("Tu solicitud sigue pendiente de aprobación. Busca a alguien del equipo.");
      } else if (res.reason === "cancelled") {
        setError("Esa inscripción fue cancelada.");
      } else if (res.reason === "outside_window") {
        setError("El registro de entrada no está abierto en este momento.");
      } else {
        setResult(res);
      }
    } catch {
      setError("No pudimos registrar tu entrada. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center gap-2">
          <img src="/salgon-logo.png" alt="Salgon" className="h-8 w-8 rounded-lg object-cover" />
          <div className="leading-tight">
            <div className="text-sm font-semibold text-gray-900">Inmobiliaria Salgon</div>
            <div className="text-[11px] text-gray-500">Registro de entrada</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-6 space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-xs uppercase tracking-wider text-gray-400 mb-1">Bienvenido a</div>
          <h1 className="text-lg font-semibold text-gray-900">{event.title}</h1>
          {event.location && <p className="text-sm text-gray-600 mt-1">{event.location}</p>}
        </div>

        {result ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center space-y-2">
            <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-600" />
            <h2 className="text-2xl font-semibold text-emerald-900 leading-tight">
              {result.reason === "already" ? `${result.name}, ya estabas registrado` : `¡Bienvenido, ${result.name}!`}
            </h2>
            <p className="text-sm text-emerald-800 inline-flex items-center gap-1.5 justify-center">
              <Clock className="h-4 w-4" />
              {result.checkedInAt
                ? new Date(result.checkedInAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
                : ""}
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
            <p className="text-sm text-gray-600">
              Escribe el correo con el que te inscribiste y registramos tu entrada.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="checkin-email">Correo</Label>
              <Input
                id="checkin-email"
                type="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                placeholder="tucorreo@ejemplo.com"
                required
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full gap-1.5" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Registrar mi entrada
            </Button>
          </form>
        )}
      </main>
    </div>
  );
}
