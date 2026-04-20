import { createFileRoute } from "@tanstack/react-router";
import { Plus, Phone, Mail } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/common/PageCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { agents, leads, fmtMoney } from "@/data/mock";

export const Route = createFileRoute("/leads")({ component: LeadsPage });

function LeadsPage() {
  return (
    <AppShell title="Leads & Clients" subtitle="Track and qualify incoming clients">
      <PageCard
        title="All Leads"
        description={`${leads.length} active leads`}
        action={<AddLeadDialog />}
      >
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-3 py-3 font-medium">Contact</th>
                <th className="px-3 py-3 font-medium">Interest</th>
                <th className="px-3 py-3 font-medium">Budget</th>
                <th className="px-3 py-3 font-medium">Source</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Agent</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => {
                const agent = agents.find((a) => a.id === l.agentId);
                return (
                  <tr key={l.id} className="border-b border-border/60 hover:bg-muted/40">
                    <td className="px-5 py-3">
                      <div className="font-medium">{l.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{l.id}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{l.phone}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{l.email}</div>
                    </td>
                    <td className="px-3 py-3">{l.interest}</td>
                    <td className="px-3 py-3 font-medium">{fmtMoney(l.budget)}</td>
                    <td className="px-3 py-3"><span className="text-xs px-2 py-0.5 rounded-md bg-muted">{l.source}</span></td>
                    <td className="px-3 py-3"><StatusBadge status={l.status} /></td>
                    <td className="px-5 py-3">{agent?.name}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </PageCard>
    </AppShell>
  );
}

function AddLeadDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild><Button className="gap-1.5"><Plus className="h-4 w-4" /> Add Lead</Button></DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Add new lead</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label>Full name</Label><Input placeholder="John Doe" /></div>
          <div className="space-y-1.5"><Label>Phone</Label><Input placeholder="+961 70 000 000" /></div>
          <div className="col-span-2 space-y-1.5"><Label>Email</Label><Input type="email" placeholder="email@example.com" /></div>
          <div className="col-span-2 space-y-1.5"><Label>Interest</Label><Input placeholder="3-bedroom in Achrafieh" /></div>
          <div className="space-y-1.5"><Label>Budget (USD)</Label><Input type="number" placeholder="250000" /></div>
          <div className="space-y-1.5"><Label>Source</Label>
            <Select><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Website">Website</SelectItem>
                <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                <SelectItem value="Referral">Referral</SelectItem>
                <SelectItem value="Walk-in">Walk-in</SelectItem>
                <SelectItem value="Facebook">Facebook</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Status</Label>
            <Select defaultValue="New"><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["New","Contacted","Visit","Negotiation","Closed"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Assigned agent</Label>
            <Select><SelectTrigger><SelectValue placeholder="Select agent" /></SelectTrigger>
              <SelectContent>{agents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter><Button variant="outline">Cancel</Button><Button>Save lead</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
