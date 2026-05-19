import { createFileRoute } from "@tanstack/react-router";
import { EventEditor } from "@/components/events/EventEditor";
import { RouteErrorBoundary } from "@/components/layout/RouteErrorBoundary";

export const Route = createFileRoute("/events/new")({
  component: () => <EventEditor />,
  errorComponent: ({ error, reset }) => <RouteErrorBoundary title="Nuevo evento" error={error} reset={reset} />,
});
