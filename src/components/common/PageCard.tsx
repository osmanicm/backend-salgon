import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageCard({
  title,
  description,
  action,
  className,
  children,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]", className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-4 md:px-5 pt-4 md:pt-5 pb-3">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold tracking-tight">{title}</h2>}
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
          {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
        </header>
      )}
      <div className="px-4 md:px-5 pb-4 md:pb-5">{children}</div>
    </section>
  );
}
