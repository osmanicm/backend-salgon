# Diseño — Subproyecto #1: Visibilidad y permisos de propiedades

**Fecha:** 2026-06-11
**Estado:** Diseño aprobado → pasar a plan de implementación.
**Contexto:** Parte 1 de 2. El #2 (sistema de notificaciones in-app en la campana de la Topbar, que avisa a los agentes cuando se vende una casa) se brainstormea aparte después de este.

## Problema / objetivo

Hoy cualquier usuario autenticado ve todas las propiedades activas (incluidas las vendidas) y el agente asignado puede editarlas; insertar lo puede hacer cualquiera. Se requiere:
- Solo **admins** crean/editan/eliminan propiedades y deciden el estatus (Vendida/Disponible/Reservada). Agentes = **solo lectura**.
- Al venderse una casa, **la propiedad, sus fotos/documentos y sus citas desaparecen para los agentes**. Los admins siguen viéndolo todo.
- Los **prospectos (leads) NO se ocultan** (siguen visibles para los agentes).

## Decisiones (brainstorming 2026-06-11)

| Decisión | Elección |
|----------|----------|
| Capa de enforcement | **RLS** (aplica en lista, buscador, asistente IA y detalle) |
| Agentes sobre propiedades | **Solo lectura** (crear/editar/eliminar = admin-only) |
| Vendidas para el agente | No ve **ninguna**, ni las suyas |
| "Todo lo relacionado" oculto | Propiedad + `property_media` + `property_files` + `appointments` |
| Leads | **Sin cambios** (visibles a agentes) |
| Notificaciones | Fuera de alcance (subproyecto #2) |

## Hechos verificados (código actual)

- `status` es enum `public.property_status` ('Available','Reserved','Sold'). `status <> 'Sold'` es válido.
- RLS `properties` SELECT actual: `using (deleted_at is null or has_role(admin))`.
- RLS `properties` INSERT: `with check (auth.uid() is not null)` (cualquiera). UPDATE/DELETE: `agent_id = auth.uid() or has_role(admin)`.
- `property_media`/`property_files` SELECT ya usan `EXISTS(SELECT 1 FROM properties p WHERE p.id = <tabla>.property_id AND p.deleted_at IS NULL)`.
- `appointments` SELECT: `using (agent_id = auth.uid() OR has_role(auth.uid(),'admin'))`. Referencia `property_id`.
- `function public.has_role(uuid, app_role)` existe y se usa en todo el RLS.
- UI `/properties`: `canEdit = isAdmin` (edición ya admin-only); filtro de estatus incluye opción "Vendido" visible a todos.
- Crear propiedades manualmente está deshabilitado en UI (se generan desde Disponibilidad).

## Cambios — migración SQL (una sola)

Nueva migración `supabase/migrations/<timestamp>_properties_visibility_permissions.sql`.

### A) Propiedades admin-only (escritura)
Reemplazar las políticas de escritura:
```sql
drop policy if exists "Properties: authenticated insert" on public.properties;
drop policy if exists "Properties: agent or admin update" on public.properties;
drop policy if exists "Properties: agent or admin delete" on public.properties;

create policy "Properties: admin insert" on public.properties
  for insert to authenticated
  with check (public.has_role(auth.uid(),'admin'));

create policy "Properties: admin update" on public.properties
  for update to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

create policy "Properties: admin delete" on public.properties
  for delete to authenticated
  using (public.has_role(auth.uid(),'admin'));
```

### B) Ocultar vendidas a agentes (lectura)
```sql
drop policy if exists "Properties: authenticated read non-deleted" on public.properties;
create policy "Properties: read non-deleted, agents exclude sold" on public.properties
  for select to authenticated
  using ( public.has_role(auth.uid(),'admin')
          or (deleted_at is null and status <> 'Sold') );
```

`property_media` y `property_files`: recrear su política SELECT extendiendo el `EXISTS` con `and p.status <> 'Sold'` y bypass admin. Patrón (ajustar nombre de tabla):
```sql
drop policy if exists "Media: authenticated read non-deleted" on public.property_media;
create policy "Media: read non-deleted, exclude sold" on public.property_media
  for select to authenticated
  using ( public.has_role(auth.uid(),'admin')
          or exists (select 1 from public.properties p
                     where p.id = property_media.property_id
                       and p.deleted_at is null
                       and p.status <> 'Sold') );
```
(Equivalente para `property_files` con `"Files: authenticated read non-deleted"`.)

`appointments`: recrear SELECT para excluir citas de propiedades vendidas a los agentes (preservando citas sin propiedad y de no-vendidas para su dueño):
```sql
drop policy if exists "Appts: owner or admin select" on public.appointments;
create policy "Appts: owner or admin select, exclude sold" on public.appointments
  for select to authenticated
  using ( public.has_role(auth.uid(),'admin')
          or ( agent_id = auth.uid()
               and ( property_id is null
                     or exists (select 1 from public.properties p
                                where p.id = appointments.property_id
                                  and p.deleted_at is null
                                  and p.status <> 'Sold') ) ) );
```

> Nota: confirmar al implementar la nulabilidad de `appointments.property_id`; el predicado ya contempla `property_id is null`.

### Sin cambios
- Escrituras de `property_media`/`property_files` (ya detrás de UI admin-only; se dejan como están para no ampliar el alcance).
- Políticas de `leads`.

## Cambios — UI (mínimo)

`src/routes/properties.tsx`:
- Ocultar la opción de filtro **"Vendido"** (`<SelectItem value="Sold">`) para no-admins (`!isAdmin`). Mantener para admins.
- Confirmar que crear/editar/eliminar siguen admin-only (ya lo están vía `canEdit = isAdmin`); sin cambios adicionales.

Sin cambios en `propertiesApi.ts` ni otros hooks: el RLS filtra del lado servidor.

## Pruebas / verificación

- **Como agente** (`osmanicm@gmail.com`): la lista no muestra vendidas; no aparecen media/citas de vendidas; no puede crear/editar/eliminar propiedades (RLS rechaza). El filtro no muestra "Vendido".
- **Como admin** (`inmobiliariasalgon@gmail.com`): ve y gestiona todo (vendidas, eliminadas, media, citas).
- Verificación manual con ambas cuentas (la app se prueba con admin + manual, no hay runner de unit tests; el E2E corre como admin).
- Comprobar el asistente IA como agente: `search_properties`/`resolve_property` no devuelven vendidas.

## Efectos secundarios aceptados

- Una cita de un agente sobre una casa que luego se vende deja de verse para él (es el comportamiento pedido: "todo desaparece relacionado con esa casa").
- Los objetos en Storage (buckets) tienen sus propias políticas; ocultar las filas de `property_media`/`property_files` quita la referencia/URL al agente, suficiente para este alcance. Endurecer storage por estatus queda fuera.

## Fuera de alcance (subproyecto #2)

Sistema de notificaciones in-app: tabla `notifications` + RLS + hooks + dropdown en la campana de la Topbar + emitir notificación a los agentes cuando una propiedad pasa a Vendida.
