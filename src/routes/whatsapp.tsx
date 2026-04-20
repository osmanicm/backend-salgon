import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Send, MessageCircle, CheckCheck, FileText, X, Download } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/common/PageCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { whatsappTemplates, leads } from "@/data/mock";
import { consumeWhatsappHandoff, type WhatsappHandoff } from "@/data/whatsappHandoff";
import { toast } from "sonner";

export const Route = createFileRoute("/whatsapp")({ component: WhatsappPage });

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function WhatsappPage() {
  const [body, setBody] = useState(whatsappTemplates[0].body);
  const [to, setTo] = useState(leads[0].id);
  const [attachment, setAttachment] = useState<WhatsappHandoff["attachment"] | null>(null);

  // Consume handoff from Availability → WhatsApp on mount
  useEffect(() => {
    const h = consumeWhatsappHandoff();
    if (!h) return;
    setBody(h.message);
    if (h.toLeadId && leads.some((l) => l.id === h.toLeadId)) setTo(h.toLeadId);
    if (h.attachment) {
      setAttachment(h.attachment);
      toast.success("PDF adjunto desde Disponibilidad", {
        description: `${h.attachment.filename} · ${formatBytes(h.attachment.sizeBytes)}`,
      });
    } else {
      toast.success("Mensaje pre-cargado", {
        description: "Revisa el contenido antes de enviar.",
      });
    }
  }, []);

  function send() {
    const lead = leads.find((l) => l.id === to);
    toast.success(`Mensaje enviado a ${lead?.name}`, {
      description: attachment
        ? `Envío simulado por WhatsApp API · adjunto ${attachment.filename}`
        : "Envío simulado por WhatsApp API",
    });
    setAttachment(null);
  }

  function downloadAttachment() {
    if (!attachment) return;
    const a = document.createElement("a");
    a.href = attachment.dataUrl;
    a.download = attachment.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <AppShell title="Integración con WhatsApp" subtitle="Envía plantillas pre-aprobadas a tus prospectos">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PageCard title="Plantillas" description="Da clic para cargar una plantilla" className="lg:col-span-1">
          <ul className="space-y-2">
            {whatsappTemplates.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => setBody(t.body)}
                  className="w-full text-left rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="text-sm font-medium flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-success" />
                    {t.name}
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-2 mt-1">{t.body}</div>
                </button>
              </li>
            ))}
          </ul>
        </PageCard>

        <PageCard
          title="Redactar Mensaje"
          description="Variables: {{name}}, {{property}}, {{date}}"
          className="lg:col-span-2"
        >
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Destinatario</Label>
                <Select value={to} onValueChange={setTo}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {leads.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name} — {l.phone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Teléfono (alterno)</Label>
                <Input placeholder="+52 …" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Mensaje</Label>
              <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>

            {attachment && (
              <div className="space-y-1.5">
                <Label>Documento adjunto</Label>
                <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                  <div className="h-9 w-9 rounded-md bg-destructive/10 text-destructive grid place-items-center">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{attachment.filename}</div>
                    <div className="text-xs text-muted-foreground">
                      PDF · {formatBytes(attachment.sizeBytes)}
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    aria-label="Descargar adjunto"
                    onClick={downloadAttachment}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    aria-label="Quitar adjunto"
                    onClick={() => setAttachment(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            <div className="rounded-xl bg-[oklch(0.96_0.04_150)] p-4">
              <div className="ml-auto max-w-sm rounded-2xl rounded-br-sm bg-success text-success-foreground px-3 py-2 text-sm shadow-[var(--shadow-soft)] space-y-2">
                {attachment && (
                  <div className="flex items-center gap-2 rounded-lg bg-success-foreground/10 px-2 py-1.5">
                    <FileText className="h-4 w-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium truncate">{attachment.filename}</div>
                      <div className="text-[10px] opacity-80">PDF · {formatBytes(attachment.sizeBytes)}</div>
                    </div>
                  </div>
                )}
                <div className="whitespace-pre-wrap break-words">
                  {body || "La vista previa aparecerá aquí"}
                </div>
                <div className="text-[10px] opacity-80 flex items-center justify-end gap-1">
                  10:24 <CheckCheck className="h-3 w-3" />
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={send} className="gap-1.5">
                <Send className="h-4 w-4" /> Enviar por WhatsApp API
              </Button>
            </div>
          </div>
        </PageCard>
      </div>
    </AppShell>
  );
}
