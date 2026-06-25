// Aviso de Privacidad — fuente única de verdad (texto + versión).
// La versión se usa para registrar y exigir la aceptación del usuario.
// Al cambiar el texto de forma sustancial, incrementa PRIVACY_VERSION (fecha ISO)
// para forzar la re-aceptación a todos los usuarios.

export const PRIVACY_VERSION = "2026-06-25";

// Datos del responsable (Constancia de Situación Fiscal, SAT, 04/06/2026).
export const PRIVACY_RESPONSIBLE = {
  legalName: "Inmobiliaria Salgón, S.A. de C.V.",
  rfc: "ISA941202SA1",
  address:
    "Calle Ébanos No. 112, Local 27, Col. Framboyanes, C.P. 86020, Villahermosa, Centro, Tabasco, México",
  email: "inmobiliariasalgon@gmail.com",
  phone: "+52 993 155 8336",
  website: "https://app.salgon.com",
} as const;

export interface PrivacySection {
  heading: string;
  paragraphs: string[];
}

export interface PrivacyNotice {
  title: string;
  lastUpdated: string;
  intro: string[];
  sections: PrivacySection[];
}

const R = PRIVACY_RESPONSIBLE;

export const PRIVACY_NOTICE: PrivacyNotice = {
  title: "Aviso de Privacidad",
  lastUpdated: PRIVACY_VERSION,
  intro: [
    `${R.legalName} (en lo sucesivo, "el Responsable"), con domicilio en ${R.address}, ` +
      `es responsable del tratamiento de sus datos personales conforme a la Ley Federal de ` +
      `Protección de Datos Personales en Posesión de los Particulares (LFPDPPP), su Reglamento ` +
      `y demás normatividad aplicable en los Estados Unidos Mexicanos.`,
    `El presente Aviso de Privacidad regula el tratamiento de los datos personales recabados a ` +
      `través de la plataforma Salgon Suite Inmobiliaria (la "Plataforma"), disponible en ${R.website}.`,
  ],
  sections: [
    {
      heading: "1. Identidad y domicilio del Responsable",
      paragraphs: [
        `Responsable: ${R.legalName}.`,
        `RFC: ${R.rfc}.`,
        `Domicilio: ${R.address}.`,
        `Correo de contacto en materia de privacidad: ${R.email}.`,
        `Teléfono: ${R.phone}.`,
      ],
    },
    {
      heading: "2. Datos personales que recabamos",
      paragraphs: [
        "Como usuario de la Plataforma (agente o administrador), recabamos: nombre completo, " +
          "correo electrónico, contraseña (almacenada de forma cifrada), números de teléfono " +
          "(móvil y de oficina), número de WhatsApp, domicilio de oficina, fotografía de perfil, " +
          "biografía profesional y enlaces a redes sociales y sitio web.",
        "También tratamos datos derivados del uso de la Plataforma: rol asignado, información de " +
          "comisiones y registros de actividad (inicios de sesión, materiales compartidos y " +
          "documentos generados) con fines operativos y de seguridad.",
        "No recabamos datos personales sensibles. Le solicitamos no capturar en la Plataforma " +
          "datos que no sean necesarios para la gestión inmobiliaria.",
      ],
    },
    {
      heading: "3. Datos de terceros (prospectos y clientes) capturados por los usuarios",
      paragraphs: [
        "La Plataforma permite a los usuarios registrar datos de prospectos y clientes, tales como " +
          "nombre, teléfono, correo electrónico, interés, presupuesto, origen del contacto, notas y " +
          "datos de las citas agendadas.",
        "Cuando usted, como usuario, captura datos de un tercero, se obliga a haber obtenido el " +
          "consentimiento de dicho titular y a poner a su disposición el aviso de privacidad " +
          "correspondiente, en términos de la LFPDPPP. El Responsable trata estos datos por cuenta " +
          "del usuario con la única finalidad de prestar el servicio de la Plataforma.",
      ],
    },
    {
      heading: "4. Finalidades del tratamiento",
      paragraphs: [
        "Finalidades primarias (necesarias para el servicio): (i) crear y administrar su cuenta y " +
          "autenticarle; (ii) operar el CRM inmobiliario: gestión de propiedades, disponibilidad, " +
          "prospectos, citas, eventos y comisiones; (iii) generar la tarjeta digital pública del " +
          "agente; (iv) enviar comunicaciones operativas y notificaciones del servicio; (v) cumplir " +
          "obligaciones legales y atender requerimientos de autoridad.",
        "Finalidades secundarias (no necesarias): elaboración de estadísticas internas y métricas de " +
          "uso para mejorar la Plataforma. Usted puede oponerse a estas finalidades secundarias " +
          `enviando una solicitud al correo ${R.email}; su negativa no condiciona el uso del servicio.`,
      ],
    },
    {
      heading: "5. Tarjeta digital pública del agente",
      paragraphs: [
        "Como parte del servicio, el perfil del agente genera una tarjeta digital de acceso público " +
          "(sin necesidad de iniciar sesión) que muestra el nombre, fotografía, datos de contacto y " +
          "redes sociales que el propio agente decida publicar. Usted controla esta información desde " +
          "su perfil y puede modificarla o limitarla en cualquier momento.",
      ],
    },
    {
      heading: "6. Transferencias y encargados",
      paragraphs: [
        "Para operar la Plataforma utilizamos proveedores que actúan como encargados y pueden " +
          "almacenar o procesar datos, incluso fuera de México: Supabase (base de datos y " +
          "autenticación), Cloudflare (alojamiento y entrega), Meta Platforms — WhatsApp Cloud API " +
          "(envío de mensajes a prospectos), Resend (envío de correos transaccionales) y Google — " +
          "Gemini (asistente de inteligencia artificial que procesa consultas e información de " +
          "inventario).",
        "Estas comunicaciones se realizan al amparo de los supuestos del artículo 37 de la LFPDPPP " +
          "(prestación de un servicio por encargo del Responsable) y no requieren su consentimiento. " +
          "No vendemos ni comercializamos sus datos personales. Fuera de estos supuestos, no se " +
          "realizan transferencias sin su consentimiento cuando éste sea exigible por la ley.",
      ],
    },
    {
      heading: "7. Derechos ARCO y revocación del consentimiento",
      paragraphs: [
        "Usted tiene derecho a Acceder, Rectificar y Cancelar sus datos personales, así como a " +
          "Oponerse a su tratamiento (derechos ARCO) y a revocar el consentimiento que nos haya " +
          `otorgado. Para ejercerlos, envíe su solicitud al correo ${R.email}, indicando su nombre, ` +
          "el derecho que desea ejercer y los datos involucrados, acompañando identificación oficial.",
        "Daremos respuesta a su solicitud en los plazos que establece la LFPDPPP. La revocación del " +
          "consentimiento o el ejercicio de los derechos de cancelación u oposición puede implicar " +
          "que no podamos seguir prestándole el servicio.",
      ],
    },
    {
      heading: "8. Medios para limitar el uso o divulgación",
      paragraphs: [
        "Usted puede limitar el uso o divulgación de sus datos ajustando la información publicada en " +
          `su perfil, o solicitándolo al correo ${R.email}.`,
      ],
    },
    {
      heading: "9. Uso de cookies y tecnologías de rastreo",
      paragraphs: [
        "La Plataforma utiliza almacenamiento local y cookies estrictamente necesarias para mantener " +
          "su sesión iniciada y el correcto funcionamiento del servicio. No se utilizan cookies de " +
          "publicidad de terceros.",
      ],
    },
    {
      heading: "10. Conservación y seguridad",
      paragraphs: [
        "Conservamos sus datos durante el tiempo necesario para cumplir las finalidades descritas y " +
          "las obligaciones legales aplicables. Implementamos medidas de seguridad administrativas, " +
          "técnicas y físicas razonables, incluyendo control de acceso por roles y cifrado de " +
          "credenciales, para proteger sus datos contra daño, pérdida, alteración o acceso no autorizado.",
      ],
    },
    {
      heading: "11. Cambios al Aviso de Privacidad",
      paragraphs: [
        "El presente Aviso de Privacidad puede ser modificado. Cualquier cambio sustancial será " +
          "notificado a través de la Plataforma y le solicitaremos aceptar nuevamente la versión " +
          "vigente antes de continuar usando el servicio. La fecha de la última actualización es " +
          `${PRIVACY_VERSION}.`,
      ],
    },
  ],
};
