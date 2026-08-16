import { useEffect, useRef } from "react";

/**
 * Widget de Turnstile (captcha de Cloudflare) para formularios públicos.
 *
 * No renderiza nada si falta `VITE_TURNSTILE_SITE_KEY`, de modo que en local o
 * antes de configurar Turnstile el formulario sigue funcionando (la server
 * function tampoco exige token cuando no hay clave secreta).
 */
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const SCRIPT_ID = "cf-turnstile-script";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
    };
  }
}

/**
 * La site key es pública por diseño (viaja en el HTML) y está atada a los
 * hostnames configurados en Cloudflare, así que vive en el código: si dependiera
 * de un .env ausente, el captcha se apagaría en silencio en cualquier build hecho
 * desde otra máquina. `VITE_TURNSTILE_SITE_KEY` la sobreescribe si hace falta
 * (por ejemplo, para un widget de pruebas).
 */
const DEFAULT_SITE_KEY = "0x4AAAAAAER8XagMvLbO0YIG";

export const TURNSTILE_SITE_KEY =
  (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) || DEFAULT_SITE_KEY;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("turnstile")), { once: true });
      return;
    }
    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("turnstile"));
    document.head.appendChild(s);
  });
}

export type TurnstileStatus = "loading" | "ready" | "error";

export function TurnstileWidget({
  onToken,
  onStatus,
}: {
  onToken: (token: string) => void;
  /** Permite al formulario explicar por qué no puede enviarse si el reto falla. */
  onStatus?: (status: TurnstileStatus) => void;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !boxRef.current) return;
    let cancelled = false;

    void loadScript()
      .then(() => {
        if (cancelled || !window.turnstile || !boxRef.current) return;
        widgetId.current = window.turnstile.render(boxRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token: string) => {
            onStatus?.("ready");
            onToken(token);
          },
          "expired-callback": () => onToken(""),
          // Dominio no autorizado, bloqueadores, red caída: el visitante nunca
          // obtendrá token, así que hay que decírselo en vez de dejarlo atorado.
          "error-callback": () => {
            onStatus?.("error");
            onToken("");
          },
        });
      })
      .catch(() => {
        if (!cancelled) onStatus?.("error");
      });

    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
    };
  }, [onToken]);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={boxRef} className="flex justify-center" />;
}
