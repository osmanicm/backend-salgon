import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Send, MessageCircle, CheckCheck } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/common/PageCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { whatsappTemplates, leads } from "@/data/mock";
import { toast } from "sonner";

export const Route = createFileRoute("/whatsapp")({ component: WhatsappPage });

function WhatsappPage() {
  const [body, setBody] = useState(whatsappTemplates[0].body);
  const [to, setTo] = useState(leads[0].id);

  function send() {
    const lead = leads.find(l => l.id === to);
    toast.success(`Message sent to ${lead?.name}`, { description: "Simulated WhatsApp delivery via API" });
  }

  return (
    <AppShell title="WhatsApp Integration" subtitle="Send pre-approved templates to your leads">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PageCard title="Templates" description="Click to load a template" className="lg:col-span-1">
          <ul className="space-y-2">
            {whatsappTemplates.map(t => (
              <li key={t.id}>
                <button onClick={() => setBody(t.body)} className="w-full text-left rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors">
                  <div className="text-sm font-medium flex items-center gap-2"><MessageCircle className="h-4 w-4 text-success" />{t.name}</div>
                  <div className="text-xs text-muted-foreground line-clamp-2 mt-1">{t.body}</div>
                </button>
              </li>
            ))}
          </ul>
        </PageCard>

        <PageCard title="Compose Message" description="Variables: {{name}}, {{property}}, {{date}}" className="lg:col-span-2">
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Recipient</Label>
                <Select value={to} onValueChange={setTo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{leads.map(l => <SelectItem key={l.id} value={l.id}>{l.name} — {l.phone}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Phone (override)</Label><Input placeholder="+961 …" /></div>
            </div>
            <div className="space-y-1.5">
              <Label>Message</Label>
              <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            <div className="rounded-xl bg-[oklch(0.96_0.04_150)] p-4">
              <div className="ml-auto max-w-sm rounded-2xl rounded-br-sm bg-success text-success-foreground px-3 py-2 text-sm shadow-[var(--shadow-soft)]">
                {body || "Preview will appear here"}
                <div className="text-[10px] opacity-80 flex items-center justify-end gap-1 mt-1">10:24 <CheckCheck className="h-3 w-3" /></div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={send} className="gap-1.5"><Send className="h-4 w-4" /> Send via WhatsApp API</Button>
            </div>
          </div>
        </PageCard>
      </div>
    </AppShell>
  );
}
