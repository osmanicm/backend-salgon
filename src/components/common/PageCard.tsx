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
    <section className={cn("rounded-xl border border-border bg-card shadow-[var(--shadow-card)]", className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
          <div>
            {title && <h2 className="text-base font-semibold tracking-tight">{title}</h2>}
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="px-5 pb-5">{children}</div>
    </section>
  );
}
