# Aviso de Privacidad + Aceptación al registro — Diseño

**Fecha:** 2026-06-24
**Estado:** Aprobado (pendiente de completar datos legales del responsable)

## Objetivo

Publicar un Aviso de Privacidad conforme a la **LFPDPPP** (Ley Federal de Protección
de Datos Personales en Posesión de los Particulares, México) para la app Salgon, y
exigir su aceptación al registrarse, dejando constancia de **quién** aceptó y **qué
día y hora**.

## Análisis de datos personales tratados

La app trata dos categorías de datos:

**A) Usuarios de la app (titulares directos — agentes y admins):**
- Identificación/contacto: nombre, correo, teléfonos (móvil/oficina), WhatsApp,
  dirección de oficina, avatar, biografía.
- Autenticación: correo + contraseña (hasheada por Supabase Auth).
- Redes sociales y sitio web (publicados en la tarjeta digital pública `/p/{id}`).
- Datos laborales/financieros: rol, comisiones; telemetría de actividad (`agent_events`).

**B) Terceros capturados por los agentes (titulares indirectos — prospectos/clientes):**
- `leads`: nombre, teléfono, correo, interés, **presupuesto** (patrimonial), origen, notas.
- `appointments`: nombre y teléfono del cliente.
- `whatsapp_messages`: teléfono y plantillas enviadas.

**Encargados / transferencias:** Supabase (BD/Auth), Cloudflare (hosting), Meta —
WhatsApp Cloud API (mensajería), Resend (correos transaccionales), Google — Gemini
(asistente IA que procesa datos de inventario y consultas).

## Decisiones

- **Alcance:** Integral — cubre a los usuarios como titulares e informa de su
  responsabilidad al capturar datos de prospectos.
- **Almacenamiento:** Tabla dedicada versionada (`privacy_acceptances`) → permite
  exigir re-aceptación cuando cambie el aviso y conserva historial de auditoría.
- **A quién aplica:** Nuevos al registrarse + usuarios existentes mediante una
  pantalla bloqueante en el próximo inicio de sesión.

## Arquitectura

### 1. Contenido versionado (`src/content/privacy-notice.ts`)
- `PRIVACY_VERSION` = `"2026-06-24"` (fecha de la versión vigente).
- `PRIVACY_NOTICE`: estructura `{ title, lastUpdated, sections: { heading, paragraphs[] }[] }`.
- Datos legales del responsable con marcadores `[PENDIENTE: …]` donde falte info real.
- Una sola fuente de verdad: la usan tanto la ruta pública como el gate.

### 2. Ruta pública `/aviso-de-privacidad`
- Sin autenticación (patrón de `/p/$id`). Renderiza el aviso completo.
- Enlazada desde el checkbox de registro y desde `/settings`.

### 3. Base de datos (migración `20260624_privacy_acceptances.sql`)
```
privacy_acceptances(
  id uuid pk default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  version text not null,
  user_agent text,
  accepted_at timestamptz not null default now()
)
```
- Índice único `(user_id, version)` → re-aceptar la misma versión es idempotente.
- RLS: lectura propia + lectura admin (auditoría); inserción propia
  (`with check (user_id = auth.uid())`). **Sin** update/delete (registro inmutable).

### 4. Capa de datos (`src/data/privacyApi.ts`)
- `useHasAcceptedPrivacy(userId)`: query → ¿existe fila con la versión vigente?
- `useRecordPrivacyAcceptance()`: mutation → `insert` idempotente (onConflict ignore),
  captura `user_agent` del navegador. `accepted_at` lo pone Postgres (`default now()`),
  por lo que la fecha/hora es autoritativa del servidor.

### 5. Flujo de aceptación
- **Registro (`auth.tsx`):** checkbox obligatorio "He leído y acepto el Aviso de
  Privacidad" (enlace a la ruta pública). Sin marcarlo no se puede crear cuenta
  (validado con Zod). Tras `signUp` exitoso, se registra la aceptación.
- **Gate (`AppShell`):** si el usuario autenticado no tiene aceptación de la versión
  vigente → `PrivacyGateScreen` bloqueante (aviso scrolleable + botón "Acepto" +
  "Cerrar sesión"). Cubre usuarios existentes y futuros cambios de versión. Mismo
  patrón que `PendingActivationScreen`.

## Componentes nuevos
- `src/content/privacy-notice.ts` — contenido + versión.
- `src/components/privacy/PrivacyNoticeContent.tsx` — render del aviso (reutilizable).
- `src/components/privacy/PrivacyGateScreen.tsx` — pantalla bloqueante.
- `src/routes/aviso-de-privacidad.tsx` — ruta pública.
- `src/data/privacyApi.ts` — hooks de datos.
- `supabase/migrations/20260624_privacy_acceptances.sql` — tabla + RLS.

## Archivos modificados
- `src/routes/auth.tsx` — checkbox + registro de aceptación en signup.
- `src/components/layout/AppShell.tsx` — integración del gate.
- `src/routes/settings.tsx` — enlace al aviso (quitar "Próximamente" si aplica).

## Fuera de alcance (v2)
- Aviso de privacidad simplificado/corto separado.
- Captura de IP del cliente (requiere cabecera de Cloudflare en server fn).
- Aviso dirigido al titular indirecto (prospecto) en el momento de captura del lead.
- Sincronización del texto desde un CMS.

## Pendiente de negocio (antes de publicar)
Completar en `privacy-notice.ts` los `[PENDIENTE: …]`: razón social, domicilio,
correo ARCO, teléfono. (RFC y sitio web opcionales.)
