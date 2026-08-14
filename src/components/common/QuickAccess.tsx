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

/**
 * Accesos rápidos del Inicio: 3 por fila en móvil, 6 en escritorio.
 *
 * Los enlaces se escriben uno por uno en vez de mapear un arreglo porque
 * /properties, /leads y /appointments validan `search` y las otras tres no:
 * con un arreglo, el `to` sería una unión y TanStack Router no puede tipar el
 * `search` que corresponde a cada ruta.
 */
const TILE =
  "flex aspect-[2/3] w-full max-w-[128px] mx-auto flex-col items-center justify-center gap-2 rounded-xl " +
  "border border-border bg-card px-1.5 text-center shadow-[var(--shadow-card)] transition-colors " +
  "hover:border-primary/40 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function TileBody({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <>
      <span className="h-12 w-12 grid place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-6 w-6" />
      </span>
      <span className="text-[11px] font-medium leading-tight text-foreground">{label}</span>
    </>
  );
}

export function QuickAccess() {
  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
      <Link to="/properties" search={{ q: "" }} className={TILE}>
        <TileBody icon={Building2} label="Propiedades" />
      </Link>
      <Link to="/availability" className={TILE}>
        <TileBody icon={ClipboardList} label="Disponibilidad" />
      </Link>
      <Link to="/leads" search={{ q: "" }} className={TILE}>
        <TileBody icon={Users} label="Prospectos" />
      </Link>
      <Link to="/appointments" search={{ q: "" }} className={TILE}>
        <TileBody icon={CalendarDays} label="Citas" />
      </Link>
      <Link to="/events" className={TILE}>
        <TileBody icon={Ticket} label="Eventos" />
      </Link>
      <Link to="/news" className={TILE}>
        <TileBody icon={Newspaper} label="Noticias" />
      </Link>
    </div>
  );
}
