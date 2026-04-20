// Lightweight cross-route handoff for "Enviar PDF por WhatsApp".
// Stored in sessionStorage so it survives the route navigation but
// doesn't pollute long-term storage.

const KEY = "salgon:whatsapp-handoff";

export interface WhatsappHandoff {
  message: string;
  /** Optional document attachment (e.g. availability PDF) */
  attachment?: {
    filename: string;
    /** data: URL so we can preview / "send" without a real backend */
    dataUrl: string;
    sizeBytes: number;
  };
  /** Optional pre-selected lead id */
  toLeadId?: string;
  meta?: {
    folio?: string;
    totalUnits?: number;
    propertyId?: string;
  };
}

export function setWhatsappHandoff(h: WhatsappHandoff) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(h));
  } catch (e) {
    console.error("No se pudo guardar el handoff de WhatsApp", e);
  }
}

export function consumeWhatsappHandoff(): WhatsappHandoff | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    return JSON.parse(raw) as WhatsappHandoff;
  } catch {
    return null;
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
