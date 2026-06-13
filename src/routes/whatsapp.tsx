import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Send, MessageCircle, FileText, X, ImagePlus, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/common/PageCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLeads } from "@/data/leadsApi";
import { useWhatsappTemplates, type WhatsappTemplateRow } from "@/data/whatsappTemplatesApi";
import { blobToDataUrl } from "@/data/whatsappHandoff";
import { sendWhatsappTemplate } from "@/lib/whatsapp.functions";
import { getAuthHeaders } from "@/lib/serverFnAuth";
import { RouteErrorBoundary } from "@/components/layout/RouteErrorBoundary";
import { toast } from "sonner";

const MAX_MEDIA_BYTES = 5 * 1024 * 1024;

export const Route = createFileRoute("/whatsapp")({
  component: WhatsappPage,
  errorComponent: ({ error, reset }) => (
    <RouteErrorBoundary title="WhatsApp" error={error} reset={reset} />
  ),
});

type VarMap = { source: string; label?: string };

function getVarMapping(t: WhatsappTemplateRow | undefined): VarMap[] {
  if (!t || !Array.isArray(t.variable_mapping)) return [];
  return t.variable_mapping as VarMap[];
}

function WhatsappPage() {
  const { data: leads = [], isLoading: leadsLoading } = useLeads();
  const { data: templates = [], isLoading: templatesLoading } = useWhatsappTemplates();
  const send = useServerFn(sendWhatsappTemplate);

  const [leadId, setLeadId] = useState("");
  const [altPhone, setAltPhone] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [manualVars, setManualVars] = useState<Record<number, string>>({});
  const [media, setMedia] = useState<{
    kind: "image" | "document";
    dataUrl: string;
    filename: string;
    mimeType: string;
  } | null>(null);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedLead = leads.find((l) => l.id === leadId);
  const template = templates.find((t) => t.id === templateId);
  const mapping = getVarMapping(template);
  const needsMedia = template?.header_format === "IMAGE" || template?.header_format === "DOCUMENT";

  useEffect(() => {
    if (!leadId && leads.length > 0) setLeadId(leads[0].id);
  }, [leads, leadId]);
  useEffect(() => {
    if (!templateId && templates.length > 0) setTemplateId(templates[0].id);
  }, [templates, templateId]);
  useEffect(() => {
    setManualVars({});
    setMedia(null);
  }, [templateId]);

  function resolveVar(vm: VarMap, index: number): string {
    if (vm.source === "lead.name") return selectedLead?.name ?? "";
    if (vm.source === "lead.phone") return selectedLead?.phone ?? "";
    if (vm.source === "lead.email") return selectedLead?.email ?? "";
    return manualVars[index] ?? "";
  }

  const resolvedVars = mapping.map((vm, i) => resolveVar(vm, i));

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > MAX_MEDIA_BYTES) {
      toast.error("El archivo supera 5 MB");
      return;
    }
    const isImage = f.type.startsWith("image/");
    if (template?.header_format === "IMAGE" && !isImage) {
      toast.error("Esta plantilla requiere una imagen");
      return;
    }
    try {
      const dataUrl = await blobToDataUrl(f);
      setMedia({
        kind: template?.header_format === "IMAGE" ? "image" : "document",
        dataUrl,
        filename: f.name,
        mimeType: f.type || "application/octet-stream",
      });
    } catch {
      toast.error("No se pudo leer el archivo");
    }
  }

  async function doSend() {
    if (sending) return;
    const phone = altPhone.trim() || selectedLead?.phone || "";
    if (!phone) {
      toast.error("No hay teléfono destino (selecciona un lead o escribe uno).");
      return;
    }
    if (!template) {
      toast.error("Selecciona una plantilla.");
      return;
    }
    if (!template.meta_template_name) {
      toast.error(
        "La plantilla no está vinculada a Meta. Pide a un admin completarla en Configuración.",
      );
      return;
    }
    if (needsMedia && !media) {
      toast.error("Esta plantilla requiere adjuntar un archivo.");
      return;
    }
    const missing = mapping.findIndex((vm, i) => resolveVar(vm, i).trim() === "");
    if (missing >= 0) {
      toast.error(`Falta el valor de la variable {{${missing + 1}}}.`);
      return;
    }
    setSending(true);
    try {
      const res = await send({
        data: {
          templateId: template.id,
          toPhone: phone,
          variables: resolvedVars,
          media: needsMedia ? media : null,
          leadId: leadId || null,
        },
        headers: await getAuthHeaders(),
      });
      if (res.ok) {
        toast.success("Mensaje enviado por WhatsApp", {
          description: res.messageId ? `ID: ${res.messageId}` : undefined,
        });
        setMedia(null);
      } else {
        toast.error(res.error);
      }
    } catch (e) {
      console.error(e);
      toast.error("Error al enviar el mensaje.");
    } finally {
      setSending(false);
    }
  }

  return (
    <AppShell
      title="Integración con WhatsApp"
      subtitle="Envía plantillas aprobadas a tus prospectos"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PageCard
          title="Plantillas"
          description="Selecciona una plantilla aprobada"
          className="lg:col-span-1"
        >
          <ul className="space-y-2">
            {templates.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => setTemplateId(t.id)}
                  className={
                    "w-full text-left rounded-lg border p-3 transition-colors " +
                    (t.id === templateId
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50")
                  }
                >
                  <div className="text-sm font-medium flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-success" />
                    {t.name}
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-2 mt-1">{t.body}</div>
                  {!t.meta_template_name && (
                    <div className="text-[10px] text-destructive mt-1">Sin vincular a Meta</div>
                  )}
                </button>
              </li>
            ))}
            {templatesLoading && (
              <li className="text-center text-xs text-muted-foreground py-6">Cargando…</li>
            )}
            {!templatesLoading && templates.length === 0 && (
              <li className="text-center text-xs text-muted-foreground py-6">
                No hay plantillas. Un admin puede crearlas en Configuración.
              </li>
            )}
          </ul>
        </PageCard>

        <PageCard
          title="Enviar mensaje"
          description="Las variables se llenan desde el prospecto"
          className="lg:col-span-2"
        >
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Destinatario</Label>
                <Select
                  value={leadId}
                  onValueChange={setLeadId}
                  disabled={leadsLoading || leads.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={leadsLoading ? "Cargando…" : "Selecciona un prospecto"}
                    />
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
                <Input
                  value={altPhone}
                  onChange={(e) => setAltPhone(e.target.value)}
                  placeholder="+52 …"
                />
              </div>
            </div>

            {mapping.length > 0 && (
              <div className="space-y-2">
                <Label>Variables</Label>
                {mapping.map((vm, i) => {
                  const isManual = vm.source === "manual";
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-10 shrink-0">{`{{${i + 1}}}`}</span>
                      {isManual ? (
                        <Input
                          value={manualVars[i] ?? ""}
                          onChange={(e) => setManualVars((m) => ({ ...m, [i]: e.target.value }))}
                          placeholder={vm.label || "Valor"}
                        />
                      ) : (
                        <Input value={resolveVar(vm, i)} disabled className="bg-muted/50" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {needsMedia && (
              <div className="space-y-1.5">
                <Label>
                  {template?.header_format === "IMAGE"
                    ? "Imagen del encabezado"
                    : "Documento del encabezado"}
                </Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={template?.header_format === "IMAGE" ? "image/*" : "*/*"}
                  className="hidden"
                  onChange={handleFile}
                />
                {media ? (
                  <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                    <div className="h-9 w-9 rounded-md bg-success/10 text-success grid place-items-center">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0 text-sm truncate">{media.filename}</div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      aria-label="Quitar"
                      onClick={() => setMedia(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImagePlus className="h-4 w-4" /> Adjuntar archivo
                  </Button>
                )}
              </div>
            )}

            <div className="rounded-xl bg-[oklch(0.96_0.04_150)] p-4">
              <div className="ml-auto max-w-sm rounded-2xl rounded-br-sm bg-success text-success-foreground px-3 py-2 text-sm shadow-[var(--shadow-soft)] space-y-2">
                <div className="whitespace-pre-wrap break-words">
                  {template?.body || "Selecciona una plantilla"}
                </div>
                {mapping.length > 0 && (
                  <div className="text-[10px] opacity-80">
                    Variables: {resolvedVars.map((v) => v || "—").join(" · ")}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={doSend} className="gap-1.5" disabled={sending}>
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Enviar por WhatsApp
              </Button>
            </div>
          </div>
        </PageCard>
      </div>
    </AppShell>
  );
}
