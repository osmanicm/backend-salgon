import { Outlet, Link, createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/hooks/useAuth";
import { SplashScreen } from "@/components/layout/SplashScreen";
import { AssistantWidget } from "@/components/assistant/AssistantWidget";

import appCss from "../styles.css?url";

interface RouterContext {
  queryClient: QueryClient;
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página no encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          La página que buscas no existe o fue movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Salgon — Panel de Administración Inmobiliaria" },
      { name: "description", content: "Panel de administración Salgon para gestionar propiedades, prospectos, citas y agentes." },
      { name: "author", content: "Salgon" },
      { property: "og:title", content: "Salgon — Panel de Administración Inmobiliaria" },
      { property: "og:description", content: "Panel de administración Salgon para gestionar propiedades, prospectos, citas y agentes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Salgon — Panel de Administración Inmobiliaria" },
      { name: "twitter:description", content: "Panel de administración Salgon para gestionar propiedades, prospectos, citas y agentes." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/t2Vw5GFTphgxpGSxkvHJKqBLfMo1/social-images/social-1776724155353-1000383238.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/t2Vw5GFTphgxpGSxkvHJKqBLfMo1/social-images/social-1776724155353-1000383238.webp" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/salgon-logo.png" },
      { rel: "apple-touch-icon", href: "/salgon-logo.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SplashScreen>
          <Outlet />
        </SplashScreen>
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
