# Diseño — Envío real por WhatsApp Cloud API (v1 saliente)

**Fecha:** 2026-06-11
**Estado:** ⏸️ EN PAUSA — diseño aprobado a nivel de decisiones, esperando solicitud del usuario para continuar a plan de implementación.
**Gap que cierra:** Hoy `/whatsapp` es 100% simulado (`send()` solo dispara un toast). Este diseño conecta el envío real vía WhatsApp Cloud API de Meta.

## Decisiones tomadas (brainstorming 2026-06-11)

| Decisión | Elección |
|----------|----------|
| Estado Meta de Salgon | Cuenta Meta Business **sí**, número WhatsApp Business API y plantillas aprobadas **no** |
| Proveedor | **Cloud API directo (Meta)** — oficial, sin sobrecosto |
| Alcance v1 | **Solo envío saliente** (bidireccional y acuses → v2) |
| Plantillas | **Vincular app ↔ Meta** (registro manual de nombre/idioma/variables, no sync automático) |
| Adjuntos | **Texto + 1 documento/imagen** en header de plantilla (galería multi-foto fuera de v1) |

## 1. Arquitectura general

El envío vive en una **server function** (mismo patrón que `notifications.functions.ts` con Resend): el cliente nunca toca el token de Meta.

```
/whatsapp (cliente)  ──►  sendWhatsappTemplate (server fn, Worker)  ──►  Graph API (Meta)
   selecciona lead+plantilla        resuelve plantilla+variables,           envía template
   + opcional 1 media               sube media, mapea errores
                                              │
                                              └──►  Supabase: log de envío (whatsapp_messages)
```

## 2. Onboarding en Meta (manual, prerrequisito — documentar paso a paso)

Entregable: doc en `docs/` con:
- Agregar producto **WhatsApp** en Meta Business → registrar/verificar número → obtener **Phone Number ID** y **WABA ID**.
- Crear **System User** con token **permanente** (permiso `whatsapp_business_messaging`).
- Crear y enviar a aprobación las **plantillas** (cuerpo con variables; para adjunto, header tipo `DOCUMENT` o `IMAGE`), anotando nombre exacto + idioma (`es_MX`).
- ⚠️ La aprobación de plantillas la decide Meta (minutos–24h). El código se construye y prueba con mocks en paralelo; el end-to-end real depende de este trámite.

## 3. Secretos (wrangler, nunca en cliente)

- `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_API_VERSION` (default `v22.0`).
- Validación al inicio de la server fn: si falta alguno → error claro, no envío silencioso.

## 4. Modelo de datos (migración Supabase)

**Extender `whatsapp_templates`** (conserva `body` como vista previa legible):
- `meta_template_name`, `meta_language` (ej. `es_MX`)
- `header_format` enum: `NONE | TEXT | IMAGE | DOCUMENT`
- `variable_mapping` jsonb: arreglo ordenado que mapea `{{1}}`, `{{2}}`… a su origen (`lead.name`, `lead.phone`, o `manual` con etiqueta)

**Nueva tabla `whatsapp_messages`** (log de auditoría, recomendada — recortable):
`id, lead_id, template_id, to_phone, meta_message_id, status, error, sent_by, created_at`.
RLS: lectura autenticados, insert vía service-role desde la server fn. No es webhook de acuses — solo registra el resultado de la llamada.

## 5. La server function `sendWhatsappTemplate`

Input validado con **Zod**: `templateId`, teléfono destino, valores de variables, media opcional (base64+mime para header). Flujo:
1. Auth: usuario autenticado y **activo** (`is_active`).
2. Resolver plantilla desde DB (nombre Meta, idioma, header, mapeo).
3. Normalizar teléfono a **E.164** (default MX `+52`); validar.
4. Si hay header-media: subir base64 a `/{phone_number_id}/media` → `media_id`.
5. Construir `components` (header media + body con parámetros) y `POST /{phone_number_id}/messages` (`type: template`).
6. Parsear respuesta → `message_id` o error; **mapear códigos de Meta a mensajes en español** (plantilla no aprobada, teléfono inválido, no entregable, etc.); registrar en `whatsapp_messages`.
7. Devolver `ApiResponse<{ messageId }>`.

## 6. Cambios en el cliente `/whatsapp`

- El **texto deja de ser libre**: al elegir plantilla, se muestra la plantilla aprobada con sus **slots de variable** llenados desde el lead seleccionado + inputs manuales (la vista previa de burbuja se mantiene, reflejando lo que realmente se enviará).
- **Destinatario**: selector de lead (teléfono E.164 desde `lead.phone`) + cablear el input "teléfono alterno" (hoy muerto, `src/routes/whatsapp.tsx:209`).
- **Adjunto**: solo **1** documento/imagen, habilitado únicamente si la plantilla tiene `header_format` IMAGE/DOCUMENT. El handoff de PDF desde Disponibilidad mapea a plantilla con header DOCUMENT. **Se oculta la galería multi-foto** en el flujo real.
- `send()` llama a la server fn; toast con id real de Meta en éxito, mensaje amable en error.

## 7. Admin `/whatsapp-templates`

Extender el form CRUD para capturar `meta_template_name`, `meta_language`, `header_format` y un constructor simple de `variable_mapping`.

## 8. Pruebas

- **Unit**: normalización de teléfono, builder del payload, resolución de variables, decisión de media, mapeo de errores Meta.
- **Integración**: server fn con Graph API mockeada (éxito, plantilla inválida, teléfono inválido, fallo de upload).
- **E2E**: flujo de redacción hasta la llamada de envío, mockeando el límite de red (el envío real a Meta no se E2E-ea).

## Fuera de alcance (v2)

Webhook de entrantes, acuses de entrega/lectura, galería multi-foto, sync automático de plantillas desde Meta, envío de texto libre en ventana de 24h.

## Puntos abiertos para revisar al retomar

- ¿Mantener la tabla de log `whatsapp_messages` (sección 4) o recortarla?
- ¿Cablear el "teléfono alterno" en v1 o dejarlo para después?
