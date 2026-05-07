import { useEffect, useRef, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, X, Send, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { askAssistant } from "@/lib/assistant.functions";
import { getAuthHeaders } from "@/lib/serverFnAuth";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Muéstrame propiedades disponibles",
  "Agéndame una visita para Jazmín lote 15 mañana a las 10am",
  "Resumen del inventario",
];

function moduleFromPath(pathname: string): string | undefined {
  if (pathname.startsWith("/availability")) return "Disponibilidad";
  if (pathname.startsWith("/properties")) return "Propiedades";
  if (pathname.startsWith("/leads")) return "Leads";
  if (pathname.startsWith("/appointments")) return "Citas";
  return undefined;
}

export function AssistantWidget() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "¡Hola! Soy tu asistente Salgon. Puedo consultar propiedades y disponibilidad en tiempo real. ¿Qué necesitas?",
    },
  ]);
  const ask = useServerFn(askAssistant);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  if (!user) return null;
  // Hide on auth pages
  if (pathname.startsWith("/auth") || pathname.startsWith("/change-password")) return null;

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await ask({
        data: {
          messages: next.slice(-12).map((m) => ({ role: m.role, content: m.content })),
          context: moduleFromPath(pathname),
        },
        headers: await getAuthHeaders(),
      });
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);
    } catch (e) {
      console.error(e);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Hubo un error al procesar tu consulta. Intenta de nuevo." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!open && (
        <div
          className="fixed z-50 flex items-center gap-2"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)", right: "1rem" }}
        >
          <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-card border border-border px-2.5 py-1 text-[11px] font-medium text-foreground shadow-md">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Asistente Virtual
          </span>
          <Button
            onClick={() => setOpen(true)}
            size="icon"
            className="relative rounded-full h-14 w-14 shadow-xl bg-primary hover:bg-primary/90"
            aria-label="Abrir asistente virtual"
            title="Asistente Virtual Salgon"
          >
            <Sparkles className="h-6 w-6" />
            <span className="absolute -top-1 -right-1 rounded-full bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 shadow">
              IA
            </span>
          </Button>
        </div>
      )}
      {open && (
        <div
          className="fixed z-50 flex flex-col bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
          style={{
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)",
            right: "1rem",
            width: "min(380px, calc(100vw - 2rem))",
            height: "min(560px, calc(100vh - 9rem))",
          }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary text-primary-foreground">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <div>
                <p className="text-sm font-semibold leading-tight">Asistente Salgon</p>
                <p className="text-[11px] opacity-80 leading-tight">
                  {moduleFromPath(pathname) ?? "General"} · datos en vivo
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div ref={scrollRef} className="p-3 space-y-3">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex",
                    m.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground",
                    )}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Consultando datos…
                </div>
              )}
              {messages.length <= 1 && (
                <div className="pt-2 space-y-1.5">
                  <p className="text-[11px] text-muted-foreground px-1">Sugerencias</p>
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="w-full text-left text-xs px-3 py-2 rounded-md border border-border hover:bg-muted transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="border-t border-border p-2 flex items-center gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pregunta sobre propiedades, lotes, precios…"
              disabled={busy}
              className="h-9 text-sm"
            />
            <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={busy || !input.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
