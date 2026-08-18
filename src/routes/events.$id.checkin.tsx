import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { ArrowLeft, Camera, CameraOff, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/common/PageCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RouteErrorBoundary } from "@/components/layout/RouteErrorBoundary";
import { getAuthHeaders } from "@/lib/serverFnAuth";
import {
  checkInAsStaff,
  eventCheckinStats,
  type CheckinResult,
  type CheckinStats,
} from "@/utils/eventCheckin.functions";
import { cn } from "@/lib/utils";

/**
 * Escáner de puerta. Lee el QR del pase (que codifica /checkin/{token}), marca
 * la entrada dejando constancia de quién escaneó, y queda listo para el
 * siguiente sin recargar.
 */
export const Route = createFileRoute("/events/$id/checkin")({
  component: ScannerPage,
  errorComponent: ({ error, reset }) => <RouteErrorBoundary title="Check-in" error={error} reset={reset} />,
});

/** El QR trae la URL completa; también se acepta un token pegado a mano. */
function extractToken(text: string): string | null {
  const trimmed = text.trim();
  const fromUrl = trimmed.match(/\/checkin\/([a-f0-9]{32,})/i);
  if (fromUrl) return fromUrl[1];
  return /^[a-f0-9]{32,}$/i.test(trimmed) ? trimmed : null;
}

/** Pitido corto, para no tener que mirar la pantalla en cada escaneo. */
function beep(ok: boolean) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = ok ? 880 : 220;
    gain.gain.value = 0.08;
    osc.start();
    setTimeout(
      () => {
        osc.stop();
        void ctx.close();
      },
      ok ? 120 : 320,
    );
  } catch {
    // Sin audio disponible: el color en pantalla basta.
  }
}

interface ScanEntry {
  key: string;
  name: string;
  ok: boolean;
  detail: string;
  at: string;
}

function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

function describe(res: CheckinResult): { ok: boolean; detail: string } {
  switch (res.reason) {
    case "ok":
      return { ok: true, detail: "Entrada registrada" };
    case "already":
      return { ok: false, detail: `Ya había entrado a las ${hhmm(res.checkedInAt!)}` };
    case "pending":
      return { ok: false, detail: "Inscripción pendiente de aprobación" };
    case "cancelled":
      return { ok: false, detail: "Inscripción cancelada" };
    case "outside_window":
      return { ok: false, detail: "Fuera del horario de registro" };
    default:
      return { ok: false, detail: "Pase no válido" };
  }
}

function ScannerPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const lastToken = useRef<{ token: string; at: number } | null>(null);

  const [scanning, setScanning] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [last, setLast] = useState<ScanEntry | null>(null);
  const [log, setLog] = useState<ScanEntry[]>([]);
  const [stats, setStats] = useState<CheckinStats | null>(null);
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);

  const refreshStats = useCallback(async () => {
    try {
      setStats(await eventCheckinStats({ data: { event_id: id }, headers: await getAuthHeaders() }));
    } catch {
      // El contador es informativo: si falla, el escáner sigue sirviendo.
    }
  }, [id]);

  useEffect(() => {
    void refreshStats();
  }, [refreshStats]);

  const handleToken = useCallback(
    async (token: string) => {
      // La cámara decodifica el mismo QR muchas veces por segundo: se ignora
      // el token repetido durante unos segundos.
      const now = Date.now();
      if (lastToken.current && lastToken.current.token === token && now - lastToken.current.at < 4000) return;
      lastToken.current = { token, at: now };

      const at = new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
      setBusy(true);
      try {
        const res = await checkInAsStaff({ data: { token }, headers: await getAuthHeaders() });
        const { ok, detail } = describe(res);
        const entry: ScanEntry = { key: `${token}-${now}`, name: res.name || "Desconocido", ok, detail, at };
        setLast(entry);
        setLog((prev) => [entry, ...prev].slice(0, 15));
        beep(ok);
        if (ok) void refreshStats();
      } catch {
        const entry: ScanEntry = {
          key: `err-${now}`,
          name: "Error de conexión",
          ok: false,
          detail: "No se pudo registrar. Revisa la señal e inténtalo de nuevo.",
          at,
        };
        setLast(entry);
        beep(false);
      } finally {
        setBusy(false);
      }
    },
    [refreshStats],
  );

  async function start() {
    setCamError(null);
    try {
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
        if (!result) return;
        const token = extractToken(result.getText());
        if (token) void handleToken(token);
      });
      controlsRef.current = controls;
      setScanning(true);
    } catch (e) {
      setCamError(
        e instanceof Error && e.name === "NotAllowedError"
          ? "No diste permiso para usar la cámara. Habilítalo en el navegador y vuelve a intentarlo."
          : "No pudimos abrir la cámara en este dispositivo.",
      );
    }
  }

  function stop() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
  }

  useEffect(() => () => controlsRef.current?.stop(), []);

  return (
    <AppShell title="Check-in" subtitle={stats?.eventTitle ?? "Registro de entrada"}>
      <PageCard
        title="Escáner de puerta"
        description={stats ? `Entraron ${stats.attended} de ${stats.approved} aprobados` : "Cargando conteo…"}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => navigate({ to: "/events/$id", params: { id } })}
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Evento
            </Button>
            {scanning ? (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={stop}>
                <CameraOff className="h-3.5 w-3.5" /> Detener
              </Button>
            ) : (
              <Button size="sm" className="gap-1.5" onClick={() => void start()}>
                <Camera className="h-3.5 w-3.5" /> Abrir cámara
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          <div className="relative rounded-xl overflow-hidden bg-black aspect-[3/4] sm:aspect-video max-h-[60vh] mx-auto">
            <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
            {!scanning && (
              <div className="absolute inset-0 grid place-items-center text-center px-6 text-sm text-white/70">
                {camError ?? "Toca «Abrir cámara» y apunta al código del asistente."}
              </div>
            )}
            {busy && (
              <div className="absolute top-2 right-2 rounded-full bg-black/60 text-white text-xs px-2 py-1 inline-flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> registrando…
              </div>
            )}
          </div>

          {/* Respaldo sin cámara: el personal teclea o pega el código del pase. */}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const token = extractToken(manual);
              if (!token) {
                setLast({
                  key: `bad-${Date.now()}`,
                  name: "Código no reconocido",
                  ok: false,
                  detail: "Revisa que sea el código completo del pase.",
                  at: new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
                });
                return;
              }
              setManual("");
              void handleToken(token);
            }}
          >
            <Input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="O pega aquí el código del pase"
              className="flex-1"
            />
            <Button type="submit" variant="outline" disabled={busy || manual.trim() === ""}>
              Registrar
            </Button>
          </form>

          {last && (
            <div
              className={cn(
                "rounded-xl border p-4 flex items-start gap-3",
                last.ok ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50",
              )}
            >
              {last.ok ? (
                <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-600" />
              ) : (
                <XCircle className="h-8 w-8 shrink-0 text-rose-600" />
              )}
              <div className="min-w-0">
                <div
                  className={cn(
                    "text-lg font-semibold leading-tight",
                    last.ok ? "text-emerald-900" : "text-rose-900",
                  )}
                >
                  {last.name}
                </div>
                <div className={cn("text-sm", last.ok ? "text-emerald-800" : "text-rose-800")}>{last.detail}</div>
              </div>
              <div className="ml-auto text-xs text-muted-foreground tabular-nums">{last.at}</div>
            </div>
          )}

          {log.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Últimos escaneos</div>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {log.map((e) => (
                  <li key={e.key} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <span className={cn("h-2 w-2 rounded-full shrink-0", e.ok ? "bg-emerald-500" : "bg-rose-500")} />
                    <span className="font-medium truncate">{e.name}</span>
                    <span className="text-xs text-muted-foreground truncate">{e.detail}</span>
                    <span className="ml-auto text-xs text-muted-foreground tabular-nums">{e.at}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </PageCard>
    </AppShell>
  );
}
