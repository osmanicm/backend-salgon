import { createFileRoute } from "@tanstack/react-router";
import { EventEditor } from "@/components/events/EventEditor";
import { RouteErrorBoundary } from "@/components/layout/RouteErrorBoundary";

export const Route = createFileRoute("/events/$id/edit")({
  component: EditEventRoute,
  errorComponent: ({ error, reset }) => <RouteErrorBoundary title="Editar evento" error={error} reset={reset} />,
});

function EditEventRoute() {
  const { id } = Route.useParams();
  return <EventEditor eventId={id} />;
}
