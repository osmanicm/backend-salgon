import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { CalendarDays, CheckCircle2, Clock, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getEventPass, checkInWithToken } from "@/utils/eventCheckin.functions";

/**
 * Pase personal del asistente. Es lo que abre desde el correo de aprobación y
 * lo que muestra en la puerta: el QR codifica /checkin/{token}, así que el
 * personal puede escanearlo o el propio invitado puede tocar el botón.
 */
const SITE_URL = "https://app.salgon.com";

export const Route = createFileRoute("/pase/$token")({
  loader: async ({ params }) => ({ pass: await getEventPass({ data: { token: params.token } }) }),
  head: () => ({ meta: [{ title: "Mi pase · Inmobiliaria Salgon" }, { name: "robots", content: "noindex" }] }),
  component: PassPage,
});

function fmt(iso: string | null) {
  if (!iso) return "Por confirmar";
  return new Date(iso).toLocaleString("es-MX", { dateStyle: "full", timeStyle: "short" });
}

function PassPage() {
  const { token } = Route.useParams();
  const { pass } = Route.useLoaderData();
  const router = useRouter();
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!pass.found || !pass.event) {
    return (
      <div className="min-h-screen grid place-items-center bg-gray-50 px-4">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">🎟️</div>
          <h1 className="text-xl font-semibold text-gray-800 mb-2">Pase no encontrado</h1>
          <p className="text-sm text-gray-500">
            Este enlace no corresponde a ninguna inscripción. Revisa el correo que te enviamos.
          </p>
        </div>
      </div>
    );
  }

  const checkinUrl = `${SITE_URL}/checkin/${token}`;
  const yaEntro = !!pass.checkedInAt;
  const pendiente = pass.status === "Pending";
  const cancelada = pass.status === "Cancelled";

  async function marcarEntrada() {
    setMarking(true);
    setError(null);
    try {
      const res = await checkInWithToken({ data: { token } });
      if (res.reason === "outside_window") {
        setError("Todavía no abre el registro de entrada para este evento.");
      } else if (res.reason === "pending") {
        setError("Tu solicitud sigue pendiente de aprobación.");
      } else if (res.reason === "cancelled") {
        setError("Esta inscripción fue cancelada.");
      } else {
        await router.invalidate();
      }
    } catch {
      setError("No pudimos registrar tu entrada. Inténtalo de nuevo.");
    } finally {
      setMarking(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center gap-2">
          <img src="/salgon-logo.png" alt="Salgon" className="h-8 w-8 rounded-lg object-cover" />
          <div className="leading-tight">
            <div className="text-sm font-semibold text-gray-900">Inmobiliaria Salgon</div>
            <div className="text-[11px] text-gray-500">Tu pase de entrada</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-5 space-y-4">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm text-center space-y-3">
          <div className="text-xs uppercase tracking-wider text-gray-400">A nombre de</div>
          <div className="text-xl font-semibold text-gray-900">{pass.name}</div>

          {pendiente ? (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              Tu solicitud está <strong>pendiente de aprobación</strong>. Te avisaremos por correo en
              cuanto Inmobiliaria Salgon la revise.
            </div>
          ) : cancelada ? (
            <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-800">
              Esta inscripción fue cancelada.
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-gray-200 bg-white p-4 inline-block">
                <QRCodeSVG value={checkinUrl} size={196} level="M" includeMargin={false} />
              </div>
              <p className="text-xs text-gray-500">Muestra este código en la entrada del evento.</p>
            </>
          )}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-2">
          <h1 className="text-base font-semibold text-gray-900">{pass.event.title}</h1>
          <div className="flex items-start gap-2 text-sm text-gray-600">
            <CalendarDays className="h-4 w-4 mt-0.5 shrink-0 text-gray-400" />
            <span className="first-letter:uppercase">{fmt(pass.event.starts_at)}</span>
          </div>
          {pass.event.location && (
            <div className="flex items-start gap-2 text-sm text-gray-600">
              <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-gray-400" />
              <span>{pass.event.location}</span>
            </div>
          )}
        </section>

        {!pendiente && !cancelada && (
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            {yaEntro ? (
              <div className="flex items-start gap-2 text-sm text-emerald-800">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                <span>
                  Entrada registrada{" "}
                  <span className="text-emerald-700">
                    · {new Date(pass.checkedInAt!).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </span>
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-500 mb-3">
                  Si no hay quien escanee tu código, puedes registrar tu entrada desde aquí al llegar.
                </p>
                <Button className="w-full gap-1.5" onClick={() => void marcarEntrada()} disabled={marking}>
                  {marking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
                  Ya llegué, registrar mi entrada
                </Button>
                {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
              </>
            )}
          </section>
        )}

        <p className="text-[11px] text-gray-400 text-center pb-6">
          Inmobiliaria Salgon ·{" "}
          <Link to="/aviso-de-privacidad" className="underline">
            Aviso de Privacidad
          </Link>
        </p>
      </main>
    </div>
  );
}
