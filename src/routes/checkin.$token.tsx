import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, CalendarDays, CheckCircle2, Clock, MapPin, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { checkInWithToken, type CheckinResult } from "@/utils/eventCheckin.functions";

/**
 * Lo que se abre al escanear el QR del asistente: marca la entrada y saluda por
 * su nombre. El trabajo ocurre en el loader (servidor), así que la pantalla ya
 * llega resuelta y sirve igual si la abre el personal o el propio invitado.
 * Recargar no duplica nada: la operación es idempotente.
 */
export const Route = createFileRoute("/checkin/$token")({
  loader: async ({ params }) => ({ result: await checkInWithToken({ data: { token: params.token } }) }),
  head: () => ({ meta: [{ title: "Check-in · Inmobiliaria Salgon" }, { name: "robots", content: "noindex" }] }),
  component: CheckinPage,
});

function fmtTime(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center gap-2">
          <img src="/salgon-logo.png" alt="Salgon" className="h-8 w-8 rounded-lg object-cover" />
          <div className="leading-tight">
            <div className="text-sm font-semibold text-gray-900">Inmobiliaria Salgon</div>
            <div className="text-[11px] text-gray-500">Registro de entrada</div>
          </div>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-md px-4 py-6">{children}</main>
    </div>
  );
}

function EventBox({ result }: { result: CheckinResult }) {
  if (!result.event) return null;
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2 text-left">
      <div className="font-semibold text-gray-900">{result.event.title}</div>
      {result.event.starts_at && (
        <div className="flex items-start gap-2 text-sm text-gray-600">
          <CalendarDays className="h-4 w-4 mt-0.5 shrink-0 text-gray-400" />
          <span className="first-letter:uppercase">
            {new Date(result.event.starts_at).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" })}
          </span>
        </div>
      )}
      {result.event.location && (
        <div className="flex items-start gap-2 text-sm text-gray-600">
          <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-gray-400" />
          <span>{result.event.location}</span>
        </div>
      )}
    </div>
  );
}

function CheckinPage() {
  const { result } = Route.useLoaderData();

  if (result.reason === "not_found") {
    return (
      <Shell>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center space-y-2">
          <XCircle className="h-10 w-10 mx-auto text-gray-400" />
          <h1 className="text-lg font-semibold text-gray-900">Pase no válido</h1>
          <p className="text-sm text-gray-500">
            Este código no corresponde a ninguna inscripción. Verifica que sea el enlace del correo.
          </p>
        </div>
      </Shell>
    );
  }

  if (result.reason === "pending" || result.reason === "cancelled") {
    const pendiente = result.reason === "pending";
    return (
      <Shell>
        <div className="space-y-4">
          <div
            className={`rounded-2xl border p-6 text-center space-y-2 ${
              pendiente ? "border-amber-200 bg-amber-50" : "border-rose-200 bg-rose-50"
            }`}
          >
            <AlertTriangle className={`h-10 w-10 mx-auto ${pendiente ? "text-amber-600" : "text-rose-600"}`} />
            <h1 className={`text-lg font-semibold ${pendiente ? "text-amber-900" : "text-rose-900"}`}>
              {pendiente ? "Inscripción pendiente" : "Inscripción cancelada"}
            </h1>
            <p className={`text-sm ${pendiente ? "text-amber-800" : "text-rose-800"}`}>
              {pendiente
                ? `La solicitud de ${result.name} aún no ha sido aprobada por Inmobiliaria Salgon, así que no puede registrar entrada.`
                : "Esta inscripción fue cancelada y no permite el acceso."}
            </p>
          </div>
          <EventBox result={result} />
        </div>
      </Shell>
    );
  }

  if (result.reason === "outside_window") {
    // La ventana se cierra por los dos lados: el mensaje cambia según si el
    // evento todavía no empieza o si ya pasó.
    const yaPaso = !!result.event?.starts_at && new Date(result.event.starts_at).getTime() < Date.now();
    return (
      <Shell>
        <div className="space-y-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center space-y-2">
            <Clock className="h-10 w-10 mx-auto text-amber-600" />
            <h1 className="text-lg font-semibold text-amber-900">
              {yaPaso ? "El registro ya cerró" : "Aún no abre el registro"}
            </h1>
            <p className="text-sm text-amber-800">
              {yaPaso
                ? `Hola ${result.name}, el registro de entrada de este evento cerró tres horas después de que terminó.`
                : `Hola ${result.name}, tu lugar está confirmado. El registro de entrada abre 3 horas antes del evento.`}
            </p>
          </div>
          <EventBox result={result} />
        </div>
      </Shell>
    );
  }

  const yaEstaba = result.reason === "already";

  return (
    <Shell>
      <div className="space-y-4">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center space-y-2">
          <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-600" />
          <h1 className="text-2xl font-semibold text-emerald-900 leading-tight">
            {yaEstaba ? `${result.name} ya había entrado` : `¡Bienvenido, ${result.name}!`}
          </h1>
          <p className="text-sm text-emerald-800">
            {/* La hora en es-MX ya termina en punto ("3:57 p. m."), así que no se le añade otro. */}
            {yaEstaba
              ? `Su entrada quedó registrada a las ${fmtTime(result.checkedInAt)}`
              : `Entrada registrada a las ${fmtTime(result.checkedInAt)} · gracias por acompañarnos`}
          </p>
        </div>

        <EventBox result={result} />

        {/* A quien ya tiene cuenta no se le invita a crearla. */}
        {!yaEstaba && !result.hasAccount && (
          <div className="rounded-2xl border border-gray-200 bg-white p-5 text-center space-y-2">
            <div className="text-sm font-semibold text-gray-900">¿Aún no tienes cuenta en Salgon?</div>
            <p className="text-sm text-gray-600">
              Es buen momento para crearla y llevar el inventario, los eventos y tus citas en el
              teléfono. Un administrador la revisa y la activa antes de que puedas entrar.
            </p>
            <Button asChild variant="outline" className="w-full mt-1">
              <Link to="/auth">Crear mi cuenta</Link>
            </Button>
          </div>
        )}
      </div>
    </Shell>
  );
}
