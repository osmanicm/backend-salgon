# Perfil de Usuario + Tarjeta Digital Pública

**Fecha:** 2026-06-04  
**Estado:** Aprobado  
**Stack:** TanStack React Start · Supabase · Cloudflare Workers · Tailwind CSS 4 · shadcn/ui

---

## Resumen

Dos superficies nuevas:

1. **`/profile`** — página privada (autenticada) donde cada usuario edita sus datos de contacto, redes sociales y foto.
2. **`/p/$id`** — tarjeta digital pública (sin auth) que funciona como presentación profesional del agente, con QR único para compartir.

---

## Base de datos

### Migración: nuevos campos en `profiles`

```sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_mobile   text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_office   text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp       text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS office_address text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio            text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS instagram      text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS facebook       text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS linkedin       text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tiktok         text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS twitter_x      text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS youtube        text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS website        text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS slug           text UNIQUE;
```

- El campo `phone` existente se mantiene sin cambios.
- Todos los nuevos campos son `nullable`.
- `slug` es único y nullable — reservado para personalización futura de URL.

### RLS

- `SELECT`: cualquier usuario autenticado puede leer cualquier perfil (necesario para la tarjeta pública con SSR).
- `UPDATE`: solo el propio usuario puede actualizar su perfil (`auth.uid() = id`).
- La ruta `/p/$id` es pública — el cliente hace la query con la anon key, que ya tiene permiso de lectura.

---

## Rutas

| Ruta | Auth | Componente | Descripción |
|------|------|-----------|-------------|
| `/profile` | ✅ Requerida | `ProfilePage` | Editar perfil propio |
| `/p/$id` | ❌ Pública | `PublicCardPage` | Tarjeta digital del agente |

---

## Arquitectura de componentes

```
src/
  routes/
    profile.tsx             ← /profile  (editar)
    p.$id.tsx               ← /p/:id    (tarjeta pública)
  components/
    profile/
      ProfileForm.tsx       ← formulario de edición (2 tabs)
      PublicCard.tsx        ← tarjeta B reutilizable (usada en /p/$id y preview en /profile)
      SocialLinks.tsx       ← íconos + links de redes sociales
  data/
    profileApi.ts           ← hooks: useProfile, useUpdateProfile, usePublicProfile
```

---

## Página `/profile` (editar)

### Encabezado

```
[ Ver mi tarjeta pública ↗ ]  [ Copiar enlace ]
```

### Tab 1 — Mis datos

| Campo | Tipo | Notas |
|-------|------|-------|
| Foto | `PropertyCoverInput` reutilizado | Upload a `avatars/` bucket + URL externa |
| Nombre completo | text input | |
| Bio / tagline | textarea (max 160 chars) | Frase corta del agente |
| Celular | tel input | `phone_mobile` |
| Teléfono fijo | tel input | `phone_office` |
| WhatsApp | tel input | `whatsapp` — puede diferir del celular |
| Email | text, read-only | No se puede cambiar desde aquí |
| Dirección de oficina | text input | `office_address` |

### Tab 2 — Redes sociales

Campos de texto para: Instagram, Facebook, LinkedIn, TikTok, X (Twitter), YouTube, Sitio web personal.

Cada campo acepta URL completa o handle (`@usuario`). Se normaliza a URL completa al guardar.

### Vista previa

Al fondo de cualquier tab: versión compacta de `PublicCard` como preview en tiempo real.

### Validación (Zod)

- `full_name`: min 2, max 100
- `bio`: max 160
- `phone_mobile`, `phone_office`, `whatsapp`: regex `/^[+\d\s().-]{7,25}$/` o vacío
- Redes sociales: `z.string().url().or(z.literal(""))` — vacío permitido

---

## Tarjeta pública `/p/$id` — Diseño B

Página standalone sin Sidebar ni Topbar. Diseño responsive, mobile-first.

### Layout

```
┌─────────────────────────────────────────┐
│  HERO  gradient(#6e0709 → #E21013)      │
│   [avatar 80px]  Nombre Apellido        │
│                  🏅 Agente Autorizado   │
│                  "Bio del agente"       │
├─────────────────────────────────────────┤
│  📱  Celular / WhatsApp                │
│  📞  Teléfono fijo                     │
│  ✉   Email                             │
│  📍  Dirección oficina                 │
│  🔗  [in] [▷] [f] [tk] [𝕏] [yt] [🌐] │
├─────────────────────────────────────────┤
│  ★ Salgon Bienes Raíces    [ QR ▣▣ ]  │
│  [ Guardar contacto .vcf ]             │
└─────────────────────────────────────────┘
```

### Comportamiento

- **QR**: generado con `qrcode.react`, apunta a `https://app.salgon.com/p/$id`
- **Guardar contacto**: genera y descarga un archivo `.vcf` (vCard 3.0) con nombre, teléfonos, email y redes
- **Campos vacíos**: se ocultan — si no tiene LinkedIn, no aparece el ícono
- **404**: si el `id` no corresponde a ningún perfil, muestra pantalla simple "Perfil no encontrado"
- **Solo agentes y admins**: si el perfil existe pero el usuario no tiene rol, la tarjeta muestra solo nombre y email

### SEO / Meta tags

```html
<title>Juan Rodríguez — Agente Salgon Bienes Raíces</title>
<meta name="description" content="Bio del agente...">
<meta property="og:image" content="avatar_url">
```

---

## Navegación

### Topbar

El avatar actual → se convierte en un dropdown `DropdownMenu` con:
- **Mi perfil** → `/profile`
- **Cerrar sesión** (actual botón LogOut, se mueve aquí)

Se elimina el botón independiente de cerrar sesión.

### Sidebar

Nuevo ítem antes del fondo (o al final de la sección principal):
- Ícono: `User`
- Texto: "Mi Perfil"
- Ruta: `/profile`

---

## Data layer

### `profileApi.ts`

```ts
useProfile(id?)              // perfil del usuario actual (o por id)
useUpdateProfile()           // mutación — solo propio perfil
usePublicProfile(id)         // perfil público por UUID (sin auth)
```

### Storage

Bucket existente `property-media` **no** se usa para avatares.  
Se crea un nuevo bucket `avatars` con:
- Público: `true`
- Límite: 5MB
- MIME: `image/jpeg`, `image/png`, `image/webp`
- Path: `{user_id}/avatar.{ext}`

---

## Dependencias nuevas

| Paquete | Uso |
|---------|-----|
| `qrcode.react` | QR generado client-side en `PublicCard` |

---

## Fuera de alcance (esta iteración)

- Slug personalizado (la columna se crea pero la UI para cambiarlo no se implementa)
- Métricas de visitas a la tarjeta
- Múltiples idiomas
- Verificación de redes sociales
