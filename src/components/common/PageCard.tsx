import { ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Type-level constraints:
 * - `subtitle` is forbidden (deprecated). Using it produces a TS error.
 * - `description` or `action` REQUIRE `title` (header must have a heading).
 *
 * These are enforced via discriminated overloads below.
 */
type BasePageCardProps = {
  className?: string;
  children: ReactNode;
};

type WithHeader = BasePageCardProps & {
  title: string;
  description?: string;
  action?: ReactNode;
  /** @deprecated Forbidden — use `description`. */
  subtitle?: never;
};

type WithoutHeader = BasePageCardProps & {
  title?: undefined;
  description?: undefined;
  action?: undefined;
  /** @deprecated Forbidden — use `description`. */
  subtitle?: never;
};

export type PageCardProps = WithHeader | WithoutHeader;

const ALLOWED_PROPS = new Set([
  "title",
  "description",
  "action",
  "className",
  "children",
]);

export function PageCard(props: PageCardProps) {
  const { title, description, action, className, children } = props;
  const warned = useRef(false);

  useEffect(() => {
    if (!import.meta.env.DEV || warned.current) return;
    warned.current = true;

    const all = props as Record<string, unknown>;
    const unknown = Object.keys(all).filter((k) => !ALLOWED_PROPS.has(k));
    if (unknown.length > 0) {
      console.warn(
        `[PageCard] Unsupported prop(s): ${unknown.join(", ")}. ` +
          (unknown.includes("subtitle")
            ? "`subtitle` is deprecated — use `description`. "
            : "") +
          `Allowed: ${[...ALLOWED_PROPS].join(", ")}.`,
      );
    }
    if ((description || action) && !title) {
      console.warn(
        "[PageCard] `description`/`action` require `title`. Header will not render without it.",
      );
    }
  }, [props, title, description, action]);

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
