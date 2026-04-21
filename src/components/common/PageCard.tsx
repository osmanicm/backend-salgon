import { ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type PageCardProps = {
  title?: string;
  description?: string;
  /** @deprecated use `description` */
  subtitle?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
};

const ALLOWED_PROPS = new Set<keyof PageCardProps>([
  "title",
  "description",
  "subtitle",
  "action",
  "className",
  "children",
]);

export function PageCard(props: PageCardProps) {
  const { title, description, subtitle, action, className, children } = props;
  const desc = description ?? subtitle;
  const warned = useRef(false);

  useEffect(() => {
    if (!import.meta.env.DEV || warned.current) return;
    warned.current = true;

    // Warn for unknown props (e.g. typos like `descripton`, `header`, etc.)
    const unknown = Object.keys(props as Record<string, unknown>).filter(
      (k) => !ALLOWED_PROPS.has(k as keyof PageCardProps),
    );
    if (unknown.length > 0) {
      console.warn(
        `[PageCard] Unsupported prop(s): ${unknown.join(", ")}. ` +
          `Allowed: ${[...ALLOWED_PROPS].join(", ")}.`,
      );
    }

    // Warn when deprecated `subtitle` is used
    if (subtitle !== undefined) {
      console.warn(
        "[PageCard] Prop `subtitle` is deprecated — use `description` instead.",
      );
    }

    // Confirm required props for visible header
    if ((action || desc) && !title) {
      console.warn(
        "[PageCard] `title` is recommended when `action` or `description` is provided.",
      );
    }

    // Warn when description is given without a title (no header rendered)
    if (desc && !title && !action) {
      console.warn(
        "[PageCard] `description` provided without `title` — header will not render.",
      );
    }
  }, [props, title, action, desc, subtitle]);

  return (
    <section className={cn("rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]", className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-4 md:px-5 pt-4 md:pt-5 pb-3">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold tracking-tight">{title}</h2>}
            {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
          </div>
          {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
        </header>
      )}
      <div className="px-4 md:px-5 pb-4 md:pb-5">{children}</div>
    </section>
  );
}
