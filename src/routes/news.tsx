import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Eye, EyeOff, Loader2, Star, Calendar, Filter, Newspaper,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/common/PageCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PropertyCoverInput } from "@/components/properties/PropertyCoverInput";
import { useAuth } from "@/hooks/useAuth";
import { useProperties } from "@/data/propertiesApi";
import {
  useNews, useCreateNews, useUpdateNews, useDeleteNews,
  NEWS_CATEGORIES, type NewsCategory, type NewsRow,
} from "@/data/newsApi";
import { normalizeImageUrl } from "@/lib/imageUrl";
import { cn } from "@/lib/utils";
import { RouteErrorBoundary } from "@/components/layout/RouteErrorBoundary";

export const Route = createFileRoute("/news")({
  component: NewsPage,
  errorComponent: ({ error, reset }) => <RouteErrorBoundary title="Noticias" error={error} reset={reset} />,
});

function NewsPage() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  return isAdmin ? <AdminNews /> : <AgentNews />;
}

// ─────────────────────────────── Filters ───────────────────────────────
function useNewsFilters(items: NewsRow[]) {
  const [category, setCategory] = useState<"all" | NewsCategory>("all");
  const [period, setPeriod] = useState<"all" | "7d" | "30d">("all");
  const filtered = useMemo(() => {
    const now = Date.now();
    return items.filter((n) => {
      if (category !== "all" && n.category !== category) return false;
      if (period !== "all") {
        const days = period === "7d" ? 7 : 30;
        if (now - new Date(n.created_at).getTime() > days * 86400_000) return false;
      }
      return true;
    });
  }, [items, category, period]);
  return { category, setCategory, period, setPeriod, filtered };
}

function FiltersBar(props: {
  category: "all" | NewsCategory; setCategory: (v: "all" | NewsCategory) => void;
  period: "all" | "7d" | "30d"; setPeriod: (v: "all" | "7d" | "30d") => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Filter className="h-4 w-4 text-muted-foreground" />
      <Select value={props.category} onValueChange={(v) => props.setCategory(v as "all" | NewsCategory)}>
        <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las categorías</SelectItem>
          {NEWS_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={props.period} onValueChange={(v) => props.setPeriod(v as "all" | "7d" | "30d")}>
        <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Cualquier fecha</SelectItem>
          <SelectItem value="7d">Últimos 7 días</SelectItem>
          <SelectItem value="30d">Últimos 30 días</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

// ─────────────────────────────── Agent Feed ───────────────────────────────
function AgentNews() {
  const { data: items = [], isLoading } = useNews({ onlyPublished: true });
  const { category, setCategory, period, setPeriod, filtered } = useNewsFilters(items);
  return (
    <AppShell title="Noticias" subtitle="Comunicación interna de Salgon">
      <PageCard>
        <FiltersBar category={category} setCategory={setCategory} period={period} setPeriod={setPeriod} />
      </PageCard>
      {isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Cargando…</div>
      ) : filtered.length === 0 ? (
        <PageCard>
          <div className="py-10 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <Newspaper className="h-8 w-8 opacity-50" />
            No hay noticias publicadas todavía.
          </div>
        </PageCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((n) => <NewsCard key={n.id} n={n} />)}
        </div>
      )}
    </AppShell>
  );
}

function isNew(n: NewsRow) {
  return Date.now() - new Date(n.created_at).getTime() < 3 * 86400_000;
}

function NewsCard({ n }: { n: NewsRow }) {
  const img = normalizeImageUrl(n.image_url ?? "");
  const summary = (n.description ?? "").replace(/\s+/g, " ").trim().slice(0, 140);
  return (
    <Link
      to="/news/$id"
      params={{ id: n.id }}
      className={cn(
        "group rounded-2xl border bg-card overflow-hidden shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-elevated)] transition-shadow flex flex-col",
        n.highlighted ? "border-primary/40 ring-1 ring-primary/20" : "border-border",
      )}
    >
      <div className="relative aspect-video bg-muted overflow-hidden">
        {img ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <img src={img} alt="" className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform" />
        ) : (
          <div className="h-full w-full grid place-items-center text-muted-foreground"><Newspaper className="h-8 w-8" /></div>
        )}
        <div className="absolute top-2 left-2 flex gap-1.5">
          {isNew(n) && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">Nuevo</span>}
          {n.highlighted && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-warning/90 text-warning-foreground inline-flex items-center gap-1"><Star className="h-3 w-3" /> Destacada</span>}
        </div>
      </div>
      <div className="p-4 flex flex-col gap-2 flex-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{n.category}</span>
        <h3 className="font-semibold leading-snug line-clamp-2">{n.title}</h3>
        <p className="text-sm text-muted-foreground line-clamp-3">{summary}</p>
        <div className="mt-auto pt-2 text-xs text-muted-foreground flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          {new Date(n.event_date ?? n.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
        </div>
      </div>
    </Link>
  );
}

// ─────────────────────────────── Admin Manager ───────────────────────────────
function AdminNews() {
  const { data: items = [], isLoading } = useNews();
  const { category, setCategory, period, setPeriod, filtered } = useNewsFilters(items);
  const update = useUpdateNews();
  const del = useDeleteNews();
  const [editing, setEditing] = useState<NewsRow | null>(null);
  const [confirmDel, setConfirmDel] = useState<NewsRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  async function togglePublish(n: NewsRow) {
    try {
      await update.mutateAsync({ id: n.id, patch: { status: n.status === "Published" ? "Draft" : "Published" } });
      toast.success(n.status === "Published" ? "Movida a borrador" : "Publicada");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <AppShell title="Noticias" subtitle="Centro de comunicación interna">
      <PageCard
        title="Todas las noticias"
        description={isLoading ? "Cargando…" : `${items.length} entradas`}
        action={<Button onClick={() => setCreateOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" /> Nueva noticia</Button>}
      >
        <div className="mb-3"><FiltersBar category={category} setCategory={setCategory} period={period} setPeriod={setPeriod} /></div>

        {filtered.length === 0 && !isLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No hay noticias con esos filtros.</div>
        ) : null}

        <ul className="divide-y divide-border">
          {filtered.map((n) => {
            const img = normalizeImageUrl(n.image_url ?? "");
            return (
              <li key={n.id} className="py-3 flex items-center gap-3">
                <div className="h-14 w-20 shrink-0 rounded-md bg-muted overflow-hidden grid place-items-center">
                  {img ? <img src={img} alt="" className="h-full w-full object-cover" /> : <Newspaper className="h-5 w-5 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link to="/news/$id" params={{ id: n.id }} className="font-medium hover:underline truncate">{n.title}</Link>
                    {n.highlighted && <Star className="h-3.5 w-3.5 text-warning" />}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
                    <span>{n.category}</span>
                    <span>·</span>
                    <span>{new Date(n.created_at).toLocaleDateString("es-MX")}</span>
                    <span>·</span>
                    <span className={cn("px-1.5 py-0.5 rounded-md text-[10px] font-medium",
                      n.status === "Published" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>
                      {n.status === "Published" ? "Publicada" : "Borrador"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => togglePublish(n)} title={n.status === "Published" ? "Mover a borrador" : "Publicar"}>
                    {n.status === "Published" ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(n)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDel(n)} className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </PageCard>

      <NewsFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      <NewsFormDialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }} initial={editing ?? undefined} />

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => { if (!o) setConfirmDel(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar noticia?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La noticia “{confirmDel?.title}” se eliminará permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirmDel) return;
                try {
                  await del.mutateAsync(confirmDel.id);
                  toast.success("Noticia eliminada");
                  setConfirmDel(null);
                } catch (e) { toast.error((e as Error).message); }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

// ─────────────────────────────── Form Dialog ───────────────────────────────
const schema = z.object({
  title: z.string().trim().min(3, "Título requerido").max(200),
  description: z.string().trim().min(1, "Descripción requerida").max(5000),
  category: z.enum(["Open House", "Nuevos Lanzamientos", "Promociones", "Bonos", "Avisos Internos"]),
  status: z.enum(["Published", "Draft"]),
  image_url: z.string().max(1000).optional().or(z.literal("")),
  event_date: z.string().optional().or(z.literal("")),
  related_property_id: z.string().optional().or(z.literal("")),
  highlighted: z.boolean(),
});

type FormState = z.input<typeof schema>;

function NewsFormDialog({
  open, onOpenChange, initial,
}: { open: boolean; onOpenChange: (o: boolean) => void; initial?: NewsRow }) {
  const { user } = useAuth();
  const { data: properties = [] } = useProperties();
  const create = useCreateNews();
  const update = useUpdateNews();
  const isEdit = !!initial;

  const [form, setForm] = useState<FormState>(() => ({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    category: (initial?.category ?? "Avisos Internos") as NewsCategory,
    status: (initial?.status ?? "Draft") as "Published" | "Draft",
    image_url: initial?.image_url ?? "",
    event_date: initial?.event_date ?? "",
    related_property_id: initial?.related_property_id ?? "",
    highlighted: initial?.highlighted ?? false,
  }));

  // Reset state when opening with a different record
  useMemo(() => {
    if (open) {
      setForm({
        title: initial?.title ?? "",
        description: initial?.description ?? "",
        category: (initial?.category ?? "Avisos Internos") as NewsCategory,
        status: (initial?.status ?? "Draft") as "Published" | "Draft",
        image_url: initial?.image_url ?? "",
        event_date: initial?.event_date ?? "",
        related_property_id: initial?.related_property_id ?? "",
        highlighted: initial?.highlighted ?? false,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id]);

  function up<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    const d = parsed.data;
    const payload = {
      title: d.title,
      description: d.description,
      category: d.category,
      status: d.status,
      image_url: d.image_url || null,
      event_date: d.event_date || null,
      related_property_id: d.related_property_id || null,
      highlighted: d.highlighted,
    };
    try {
      if (isEdit && initial) {
        await update.mutateAsync({ id: initial.id, patch: payload });
        toast.success("Noticia actualizada");
      } else {
        await create.mutateAsync({ ...payload, author_id: user?.id ?? null });
        toast.success("Noticia creada");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? "Editar noticia" : "Nueva noticia"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input value={form.title} onChange={(e) => up("title", e.target.value)} maxLength={200} placeholder="Ej. Open House Modelo Jazmín — Sábado 11am" />
          </div>

          <div className="space-y-1.5">
            <Label>Imagen de portada</Label>
            <PropertyCoverInput value={form.image_url ?? ""} onChange={(v) => up("image_url", v)} propertyId="news" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Categoría *</Label>
              <Select value={form.category} onValueChange={(v) => up("category", v as NewsCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NEWS_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Estado *</Label>
              <Select value={form.status} onValueChange={(v) => up("status", v as "Published" | "Draft")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Draft">Borrador</SelectItem>
                  <SelectItem value="Published">Publicado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Fecha del evento</Label>
              <Input type="date" value={form.event_date ?? ""} onChange={(e) => up("event_date", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Propiedad relacionada</Label>
              <Select
                value={form.related_property_id || "none"}
                onValueChange={(v) => up("related_property_id", v === "none" ? "" : v)}
              >
                <SelectTrigger><SelectValue placeholder="Ninguna" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ninguna</SelectItem>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.code} · {p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Descripción *</Label>
            <Textarea
              value={form.description}
              onChange={(e) => up("description", e.target.value)}
              maxLength={5000}
              rows={8}
              placeholder="Detalles completos: horarios, ubicación, beneficios, instrucciones para el agente…"
            />
            <p className="text-[11px] text-muted-foreground">Se respetan saltos de línea.</p>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <div className="text-sm font-medium flex items-center gap-1.5"><Star className="h-4 w-4 text-warning" /> Destacar</div>
              <div className="text-xs text-muted-foreground">Aparece resaltada en el feed de agentes.</div>
            </div>
            <Switch checked={form.highlighted} onCheckedChange={(v) => up("highlighted", v)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {isEdit ? "Guardar cambios" : "Crear noticia"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
