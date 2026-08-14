import { Link } from "@tanstack/react-router";
import {
  Building2,
  CalendarDays,
  ClipboardList,
  Newspaper,
  Ticket,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAppointments } from "@/data/appointmentsApi";
import { useAvailabilityUnits } from "@/data/availabilityApi";
import { useEvents } from "@/data/eventsApi";
import { useLeads } from "@/data/leadsApi";
import { useNews } from "@/data/newsApi";
import { useProperties } from "@/data/propertiesApi";

/**
 * Accesos rápidos del Inicio: 3 por fila en móvil, 6 en escritorio.
 *
 * Los enlaces se escriben uno por uno en vez de mapear un arreglo porque
 * /properties, /leads y /appointments validan `search` y las otras tres no:
 * con un arreglo, el `to` sería una unión y TanStack Router no puede tipar el
 * `search` que corresponde a cada ruta.
 *
 * Los contadores salen de las mismas consultas que alimentan cada sección, así
 * que el número del badge es exactamente lo que verás al entrar: la RLS ya
 * acota por rol (el agente ve solo sus prospectos y sus citas, y no ve las
 * propiedades vendidas; el admin ve todo).
 */
const TILE =
  "flex aspect-[2/3] w-full max-w-[128px] mx-auto flex-col items-center justify-center gap-2 rounded-xl " +
  "border border-border bg-card px-1.5 text-center shadow-[var(--shadow-card)] transition-colors " +
  "hover:border-primary/40 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function TileBody({ icon: Icon, label, count }: { icon: LucideIcon; label: string; count: number }) {
  return (
    <>
      <span className="relative h-12 w-12 grid place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-6 w-6" />
        {count > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1.5 -right-1.5 h-5 min-w-[1.25rem] justify-center rounded-full px-1 text-[10px] leading-none tabular-nums shadow"
          >
            {count > 99 ? "99+" : count}
          </Badge>
        )}
      </span>
      <span className="text-[11px] font-medium leading-tight text-foreground">{label}</span>
    </>
  );
}

export function QuickAccess() {
  const { data: properties = [] } = useProperties();
  const { data: units = [] } = useAvailabilityUnits();
  const { data: leads = [] } = useLeads();
  const { data: appointments = [] } = useAppointments();
  // El feed de noticias y eventos muestra solo lo publicado; el badge lo refleja.
  const { data: events = [] } = useEvents({ onlyPublished: true });
  const { data: news = [] } = useNews({ onlyPublished: true });

  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
      <Link to="/properties" search={{ q: "" }} className={TILE}>
        <TileBody icon={Building2} label="Propiedades" count={properties.length} />
      </Link>
      <Link to="/availability" className={TILE}>
        <TileBody icon={ClipboardList} label="Disponibilidad" count={units.length} />
      </Link>
      <Link to="/leads" search={{ q: "" }} className={TILE}>
        <TileBody icon={Users} label="Prospectos" count={leads.length} />
      </Link>
      <Link to="/appointments" search={{ q: "" }} className={TILE}>
        <TileBody icon={CalendarDays} label="Citas" count={appointments.length} />
      </Link>
      <Link to="/events" className={TILE}>
        <TileBody icon={Ticket} label="Eventos" count={events.length} />
      </Link>
      <Link to="/news" className={TILE}>
        <TileBody icon={Newspaper} label="Noticias" count={news.length} />
      </Link>
    </div>
  );
}
