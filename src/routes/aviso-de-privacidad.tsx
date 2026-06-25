import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { PrivacyNoticeContent } from "@/components/privacy/PrivacyNoticeContent";

export const Route = createFileRoute("/aviso-de-privacidad")({
  component: PrivacyNoticePage,
});

function PrivacyNoticePage() {
  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          to="/auth"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>
        <PrivacyNoticeContent />
      </div>
    </div>
  );
}
