import { useNavigate } from "@tanstack/react-router";
import { Home, Users, Calendar, ArrowRight } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useProperties } from "@/data/propertiesApi";
import { useLeads } from "@/data/leadsApi";
import { useAppointments } from "@/data/appointmentsApi";
import { fmtMoney } from "@/data/mock";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

const MAX = 5;

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nav = useNavigate() as any;
  const { data: properties = [] } = useProperties();
  const { data: leads = [] } = useLeads();
  const { data: appointments = [] } = useAppointments();

  function close() {
    onOpenChange(false);
  }

  function go(to: string, search?: Record<string, string>) {
    nav(search ? { to, search } : { to });
    close();
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar propiedades, prospectos, citas…" />
      <CommandList>
        <CommandEmpty>Sin resultados para esta búsqueda.</CommandEmpty>

        <CommandGroup heading="Navegar a">
          <CommandItem value="ir propiedades inventario" onSelect={() => go("/properties")}>
            <Home className="text-muted-foreground" />
            Propiedades
          </CommandItem>
          <CommandItem value="ir prospectos leads clientes" onSelect={() => go("/leads")}>
            <Users className="text-muted-foreground" />
            Prospectos
          </CommandItem>
          <CommandItem value="ir citas agenda visitas" onSelect={() => go("/appointments")}>
            <Calendar className="text-muted-foreground" />
            Citas
          </CommandItem>
        </CommandGroup>

        {properties.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Propiedades">
              {properties.slice(0, MAX).map((p) => (
                <CommandItem
                  key={p.id}
                  value={`propiedad ${p.id} ${p.title} ${p.location} ${p.code} ${p.model ?? ""}`}
                  onSelect={() => go(`/properties/${p.id}`)}
                >
                  <Home className="text-muted-foreground" />
                  <span className="flex-1 truncate">{p.title}</span>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                    {fmtMoney(Number(p.price))}
                  </span>
                </CommandItem>
              ))}
              {properties.length > MAX && (
                <CommandItem value="__ver_todas_propiedades__" onSelect={() => go("/properties")}>
                  <ArrowRight className="text-muted-foreground" />
                  <span className="text-muted-foreground">Ver las {properties.length} propiedades</span>
                </CommandItem>
              )}
            </CommandGroup>
          </>
        )}

        {leads.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Prospectos">
              {leads.slice(0, MAX).map((l) => (
                <CommandItem
                  key={l.id}
                  value={`prospecto ${l.id} ${l.name} ${l.email} ${l.phone} ${l.interest}`}
                  onSelect={() => go("/leads", { q: l.name })}
                >
                  <Users className="text-muted-foreground" />
                  <span className="flex-1 truncate">{l.name}</span>
                  <span className="text-xs text-muted-foreground truncate max-w-[160px] shrink-0">
                    {l.email}
                  </span>
                </CommandItem>
              ))}
              {leads.length > MAX && (
                <CommandItem value="__ver_todos_leads__" onSelect={() => go("/leads")}>
                  <ArrowRight className="text-muted-foreground" />
                  <span className="text-muted-foreground">Ver los {leads.length} prospectos</span>
                </CommandItem>
              )}
            </CommandGroup>
          </>
        )}

        {appointments.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Citas">
              {appointments.slice(0, MAX).map((a) => (
                <CommandItem
                  key={a.id}
                  value={`cita ${a.id} ${a.client_name} ${a.client_phone} ${a.property?.title ?? ""} ${a.notes ?? ""}`}
                  onSelect={() => go("/appointments", { q: a.client_name })}
                >
                  <Calendar className="text-muted-foreground" />
                  <span className="flex-1 truncate">{a.client_name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {format(parseISO(a.scheduled_at), "d MMM", { locale: es })}
                  </span>
                </CommandItem>
              ))}
              {appointments.length > MAX && (
                <CommandItem value="__ver_todas_citas__" onSelect={() => go("/appointments")}>
                  <ArrowRight className="text-muted-foreground" />
                  <span className="text-muted-foreground">Ver las {appointments.length} citas</span>
                </CommandItem>
              )}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
