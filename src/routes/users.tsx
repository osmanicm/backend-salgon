import { createFileRoute } from "@tanstack/react-router";
import { Plus, Mail, Phone } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/common/PageCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { agents } from "@/data/mock";

export const Route = createFileRoute("/users")({ component: UsersPage });

function initials(name: string) {
  return name.split(" ").map(p => p[0]).slice(0, 2).join("");
}

function UsersPage() {
  return (
    <AppShell title="Users" subtitle="Admins and agents managing the platform">
      <PageCard
        title="Team members"
        description={`${agents.length} active users`}
        action={<Button className="gap-1.5"><Plus className="h-4 w-4" /> Invite user</Button>}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {agents.map(a => (
            <div key={a.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-primary text-primary-foreground">{initials(a.name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{a.name}</div>
                    <StatusBadge status={a.role} />
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">{a.id}</div>
                </div>
              </div>
              <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{a.email}</div>
                <div className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{a.phone}</div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 pt-4 border-t border-border">
                <div>
                  <div className="text-xl font-semibold">{a.propertiesAssigned}</div>
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Properties</div>
                </div>
                <div>
                  <div className="text-xl font-semibold">{a.leadsAssigned}</div>
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Leads</div>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="outline" className="flex-1">Assign</Button>
                <Button size="sm" variant="outline" className="flex-1">Edit</Button>
              </div>
            </div>
          ))}
        </div>
      </PageCard>
    </AppShell>
  );
}
