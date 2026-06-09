import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  User,
  KeyRound,
  Palette,
  Bell,
  MessageSquareText,
  Building2,
  UserCog,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/common/PageCard";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { RouteErrorBoundary } from "@/components/layout/RouteErrorBoundary";

export const Route = createFileRoute("/settings")({
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/auth" });
  },
  component: SettingsPage,
  errorComponent: ({ error, reset }) => (
    <RouteErrorBoundary title="Configuración" error={error} reset={reset} />
  ),
});

/**
 * Rutas internas a las que un ítem de configuración puede navegar hoy.
 * Conforme se construyan más pantallas, agrégalas aquí y al ítem correspondiente.
 */
type SettingRoute = "/profile" | "/change-password" | "/users";

interface SettingItem {
  label: string;
  description: string;
  icon: LucideIcon;
  /** Si está presente, el ítem navega a esa ruta. Si no, está deshabilitado. */
  to?: SettingRoute;
  /** Solo visible para administradores. */
  adminOnly?: boolean;
  /** Marca el ítem como "Próximamente" (deshabilitado). */
  soon?: boolean;
}

interface SettingSection {
  title: string;
  items: SettingItem[];
}

/**
 * Catálogo central de opciones de configuración. Para añadir una nueva opción:
 * 1. Agrega el ítem a la sección correspondiente.
 * 2. Cuando exista su pantalla, define `to` y quita `soon`.
 */
const sections: SettingSection[] = [
  {
    title: "Cuenta",
    items: [
      {
        label: "Mi perfil",
        description: "Datos públicos y tarjeta digital",
        icon: User,
        to: "/profile",
      },
      {
        label: "Cambiar contraseña",
        description: "Actualiza tu acceso",
        icon: KeyRound,
        to: "/change-password",
      },
    ],
  },
  {
    title: "Preferencias",
    items: [
      {
        label: "Apariencia",
        description: "Tema claro/oscuro y colores",
        icon: Palette,
        soon: true,
      },
      {
        label: "Notificaciones",
        description: "Avisos por correo y en la aplicación",
        icon: Bell,
        soon: true,
      },
    ],
  },
  {
    title: "Administración",
    items: [
      {
        label: "Plantillas de WhatsApp",
        description: "Mensajes pre-aprobados para envíos",
        icon: MessageSquareText,
        adminOnly: true,
        soon: true,
      },
      {
        label: "Marca y branding",
        description: "Logo, colores y datos de la empresa",
        icon: Building2,
        adminOnly: true,
        soon: true,
      },
      {
        label: "Usuarios y roles",
        description: "Administradores y agentes",
        icon: UserCog,
        to: "/users",
        adminOnly: true,
      },
    ],
  },
];

function SettingsPage() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");

  const visibleSections = sections
    .map((s) => ({ ...s, items: s.items.filter((it) => isAdmin || !it.adminOnly) }))
    .filter((s) => s.items.length > 0);

  return (
    <AppShell title="Configuración" subtitle="Preferencias de tu cuenta y de la plataforma">
      <div className="space-y-4">
        {visibleSections.map((section) => (
          <PageCard key={section.title} title={section.title}>
            <ul className="-mx-1 divide-y divide-border">
              {section.items.map((item) => (
                <SettingRow key={item.label} item={item} />
              ))}
            </ul>
          </PageCard>
        ))}
      </div>
    </AppShell>
  );
}

function SettingRow({ item }: { item: SettingItem }) {
  const Icon = item.icon;
  const isDisabled = item.soon || !item.to;

  const inner = (
    <>
      <span className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
        <Icon className="h-5 w-5" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium flex items-center gap-2">
          {item.label}
          {item.soon && (
            <Badge variant="secondary" className="text-[10px] font-normal">
              Próximamente
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground truncate">{item.description}</div>
      </div>
      {!isDisabled && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
    </>
  );

  if (isDisabled || !item.to) {
    return (
      <li>
        <div
          className="flex items-center gap-3 px-1 py-3 opacity-60 cursor-not-allowed"
          aria-disabled="true"
        >
          {inner}
        </div>
      </li>
    );
  }

  return (
    <li>
      <Link
        to={item.to}
        className="flex items-center gap-3 px-1 py-3 hover:bg-muted/40 active:bg-muted/60 transition-colors rounded-lg"
      >
        {inner}
      </Link>
    </li>
  );
}
