# Visibilidad y permisos de propiedades — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que los agentes sean solo-lectura en propiedades y que, al venderse una casa, esa propiedad y su media/archivos/citas desaparezcan para los agentes (admins ven y gestionan todo).

**Architecture:** Casi todo es **RLS** en Supabase (una migración que toca `properties`, `property_media`, `property_files`, `appointments`). Como toda lectura pasa por el cliente Supabase del usuario (RLS-enforced), el cambio aplica en lista, buscador global, asistente IA y detalle automáticamente. La única UI que cambia es ocultar la opción de filtro "Vendido" a no-admins en `/properties` (la creación/edición ya es admin-only en la UI).

**Tech Stack:** Supabase Postgres + RLS, función `public.has_role(uuid, app_role)`, enum `public.property_status`, TanStack Router (React), React Query.

**Spec de referencia:** `docs/superpowers/specs/2026-06-11-propiedades-visibilidad-permisos-design.md`

**Nota de testing:** El proyecto NO tiene runner de unit tests (solo Playwright E2E como admin + verificación manual). RLS no se unit-testea aquí: la verificación es (a) confirmar que las políticas existen vía SQL y (b) prueba manual con cuenta de **agente** y de **admin**.

**⚠️ Nota de entorno:** Hay un solo proyecto Supabase (`hlqmfwqeildvbokawngt`); aplicar la migración impacta la base de **producción**. Se versiona el archivo y se aplica con cuidado, verificando después.

---

## File Structure

- **Create:** `supabase/migrations/20260611201500_properties_visibility_permissions.sql` — todas las políticas RLS (escritura admin-only + ocultar vendidas en properties/media/files/appointments).
- **Modify:** `src/routes/properties.tsx:223` — ocultar `<SelectItem value="Sold">` a no-admins.
- **Sin cambios:** `src/data/propertiesApi.ts` ni otros hooks (RLS filtra del lado servidor).

---

### Task 1: Crear la migración RLS

**Files:**
- Create: `supabase/migrations/20260611201500_properties_visibility_permissions.sql`

- [ ] **Step 1: Escribir el archivo de migración completo**

Crear `supabase/migrations/20260611201500_properties_visibility_permissions.sql` con exactamente este contenido:

```sql
-- Properties: visibility & permissions
-- Agentes pasan a solo-lectura en propiedades. Las propiedades vendidas (y su
-- media, archivos y citas) se vuelven invisibles para los agentes. Los admins
-- ven y gestionan todo.

-- ============================================================
-- A) Properties: escritura admin-only
-- ============================================================
drop policy if exists "Properties: authenticated insert" on public.properties;
drop policy if exists "Properties: agent or admin update" on public.properties;
drop policy if exists "Properties: agent or admin delete" on public.properties;

create policy "Properties: admin insert" on public.properties
  for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Properties: admin update" on public.properties
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Properties: admin delete" on public.properties
  for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============================================================
-- B) Properties: agentes no leen vendidas (ni eliminadas); admin lee todo
-- ============================================================
drop policy if exists "Properties: authenticated read non-deleted" on public.properties;
create policy "Properties: read non-deleted, agents exclude sold" on public.properties
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or (deleted_at is null and status <> 'Sold')
  );

-- ============================================================
-- C) property_media / property_files: ocultar las de vendidas a agentes
-- ============================================================
drop policy if exists "Media: authenticated read non-deleted" on public.property_media;
create policy "Media: read non-deleted, exclude sold" on public.property_media
  for select to authenticated
  using (
    exists (
      select 1 from public.properties p
      where p.id = property_media.property_id
        and ( public.has_role(auth.uid(), 'admin'::public.app_role)
              or (p.deleted_at is null and p.status <> 'Sold') )
    )
  );

drop policy if exists "Files: authenticated read non-deleted" on public.property_files;
create policy "Files: read non-deleted, exclude sold" on public.property_files
  for select to authenticated
  using (
    exists (
      select 1 from public.properties p
      where p.id = property_files.property_id
        and ( public.has_role(auth.uid(), 'admin'::public.app_role)
              or (p.deleted_at is null and p.status <> 'Sold') )
    )
  );

-- ============================================================
-- D) appointments: agentes dejan de ver citas de propiedades vendidas
--    (citas sin propiedad o de no-vendidas siguen visibles a su dueño)
-- ============================================================
drop policy if exists "Appts: owner or admin select" on public.appointments;
create policy "Appts: owner or admin select, exclude sold" on public.appointments
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or (
      agent_id = auth.uid()
      and (
        property_id is null
        or exists (
          select 1 from public.properties p
          where p.id = appointments.property_id
            and p.deleted_at is null
            and p.status <> 'Sold'
        )
      )
    )
  );
```

- [ ] **Step 2: Verificar que el SQL es sintácticamente válido (lectura)**

Revisar visualmente que: cada `create policy` tiene su `drop policy if exists` previo; los nombres de tabla en cada `exists` coinciden (`property_media.property_id`, `property_files.property_id`, `appointments.property_id`); y se usa `'admin'::public.app_role` en todas las llamadas a `has_role`.

- [ ] **Step 3: Commit del archivo de migración**

```bash
git add supabase/migrations/20260611201500_properties_visibility_permissions.sql
git commit -m "feat(rls): propiedades admin-only + ocultar vendidas a agentes"
```

---

### Task 2: Aplicar la migración a Supabase

**Files:**
- (aplica el SQL de Task 1 a la base remota)

- [ ] **Step 1: Aplicar la migración**

Usar la herramienta MCP de Supabase `apply_migration` con `project_id = hlqmfwqeildvbokawngt`, `name = properties_visibility_permissions` y `query` = el contenido completo del archivo creado en Task 1.

(Alternativa por CLI si se prefiere: `supabase db push`.)

Expected: aplicación sin errores. Si Postgres se queja de un nombre de política inexistente, no pasa nada: los `drop policy if exists` son idempotentes.

- [ ] **Step 2: Verificar que las políticas quedaron creadas**

Ejecutar (MCP `execute_sql`, mismo `project_id`):

```sql
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('properties','property_media','property_files','appointments')
order by tablename, cmd, policyname;
```

Expected: aparecen las nuevas políticas:
- `properties`: `Properties: admin insert` (INSERT), `Properties: admin update` (UPDATE), `Properties: admin delete` (DELETE), `Properties: read non-deleted, agents exclude sold` (SELECT).
- `property_media`: `Media: read non-deleted, exclude sold` (SELECT).
- `property_files`: `Files: read non-deleted, exclude sold` (SELECT).
- `appointments`: `Appts: owner or admin select, exclude sold` (SELECT).

Y que **ya NO** existen `Properties: authenticated insert`, `Properties: agent or admin update/delete`, `Properties: authenticated read non-deleted`, `Media/Files: authenticated read non-deleted`, `Appts: owner or admin select`.

---

### Task 3: Ocultar la opción de filtro "Vendido" a no-admins

**Files:**
- Modify: `src/routes/properties.tsx:223`

- [ ] **Step 1: Hacer condicional el `SelectItem` "Vendido"**

En `src/routes/properties.tsx`, reemplazar esta línea (223):

```tsx
                <SelectItem value="Sold">Vendido</SelectItem>
```

por:

```tsx
                {isAdmin && <SelectItem value="Sold">Vendido</SelectItem>}
```

(`isAdmin` ya está en scope: se define en la línea ~107 con `const isAdmin = useHasRole("admin");`.)

- [ ] **Step 2: Verificar type-check**

Run: `node_modules/.bin/tsc --noEmit`
Expected: sin errores (salida vacía).

- [ ] **Step 3: Lint del archivo modificado**

Run: `node_modules/.bin/eslint src/routes/properties.tsx`
Expected: sin errores nuevos. (Warnings preexistentes de CRLF `␍` son aceptables; no reformatear el archivo entero.)

- [ ] **Step 4: Commit**

```bash
git add src/routes/properties.tsx
git commit -m "feat(ui): ocultar filtro 'Vendido' a no-admins en propiedades"
```

---

### Task 4: Verificación manual (agente vs admin)

**Files:**
- (verificación manual; requiere correr la app)

- [ ] **Step 1: Arrancar el dev server**

Run: `bun run dev`
Expected: `http://localhost:8080`.

- [ ] **Step 2: Verificar como AGENTE**

Iniciar sesión con `osmanicm@gmail.com` (agente). En `/properties`:
- La lista **no** muestra ninguna propiedad con estatus Vendido.
- El filtro de estatus **no** tiene la opción "Vendido".
- No hay botón de crear ni de editar/eliminar (ya admin-only).
- En el detalle de una propiedad no vendida, sus fotos/documentos se ven normal.
- En el asistente IA, pedir "muéstrame propiedades disponibles" no lista vendidas.

> Si el agente `osmanicm` aparece desactivado (ver memoria de activación de usuarios), un admin debe activarlo primero en `/users`.

- [ ] **Step 3: Verificar como ADMIN**

Iniciar sesión con `inmobiliariasalgon@gmail.com` (admin). En `/properties`:
- Se ven **todas** las propiedades, incluidas las Vendidas.
- El filtro de estatus **sí** tiene "Vendido" y funciona.
- Crear/editar/eliminar disponibles; la papelera (eliminadas) visible.

- [ ] **Step 4: Verificar el efecto de venta (como admin → agente)**

Como **admin**, marcar una propiedad (que tenga citas/fotos y un agente asignado distinto al admin) como **Vendido** y guardar. Luego, como ese **agente**, confirmar que esa propiedad, sus fotos y sus citas ya **no** aparecen, mientras que sus prospectos (leads) ligados siguen visibles.

---

## Self-Review

**Spec coverage:**
- Propiedades admin-only (crear/editar/eliminar) → Task 1 sección A.
- Solo admin decide estatus → cubierto por update admin-only (sección A) + UI ya admin-only.
- Ocultar vendidas a agentes (propiedad) → Task 1 sección B.
- Ocultar media/archivos de vendidas → Task 1 sección C.
- Ocultar citas de vendidas → Task 1 sección D.
- Leads sin cambios → no hay task que toque `leads` (correcto).
- Admin ve todo → bypass `has_role(admin)` en cada SELECT.
- UI: ocultar filtro "Vendido" a no-admins → Task 3.
- Verificación agente/admin → Task 4.

**Placeholder scan:** Sin TBD/TODO; SQL y edición de UI completos y concretos. ✅

**Type/identifier consistency:** Nombres de política, `'admin'::public.app_role`, `property_id` por tabla y `status <> 'Sold'` consistentes entre tasks. `isAdmin` ya existe en `properties.tsx`. ✅

Sin huecos detectados.
