# WhatsApp Cloud API — Onboarding (Meta)

Prerrequisitos para que `/whatsapp` envíe de verdad.

## 1. App y número
1. En Meta Business → producto **WhatsApp** → obtén el **Phone Number ID** y el **WhatsApp Business Account (WABA) ID**.
2. Crea un **System User** con un **token permanente** y permiso `whatsapp_business_messaging`.

## 2. Secrets en el CRM
- Dev: en `.env` → `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_API_VERSION=v22.0`.
- Prod (Cloudflare): `wrangler secret put WHATSAPP_ACCESS_TOKEN` y `wrangler secret put WHATSAPP_PHONE_NUMBER_ID`.

## 3. Plantillas
1. En Meta Business → **Message Templates**, crea y envía a aprobación tus plantillas (cuerpo con variables `{{1}}`, `{{2}}`; si llevan archivo, header tipo IMAGE o DOCUMENT).
2. Anota el **nombre exacto** y el **idioma** (`es_MX`).
3. En el CRM → Configuración → **Plantillas de WhatsApp**, registra el nombre Meta, idioma, header y el mapeo de variables.

## 4. Pruebas
- Meta provee `hello_world` (idioma `en_US`, sin variables) pre-aprobada → úsala para validar el pipeline antes de tener tus plantillas.
- En modo de pruebas, agrega los números destino a la lista permitida de la app.
