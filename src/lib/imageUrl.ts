// Normaliza URLs de imagen para que sean usables directamente en <img>.
// Específicamente, convierte enlaces de Google Drive de formato "view"
// a un endpoint que devuelve el contenido binario de la imagen.

const DRIVE_FILE_RE = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
const DRIVE_OPEN_RE = /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/;
const DRIVE_UC_RE = /drive\.google\.com\/uc\?(?:[^#]*&)?id=([a-zA-Z0-9_-]+)/;

export function normalizeImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";

  const m =
    trimmed.match(DRIVE_FILE_RE) ||
    trimmed.match(DRIVE_OPEN_RE) ||
    trimmed.match(DRIVE_UC_RE);
  if (m && m[1]) {
    // googleusercontent.com es más confiable para hotlinking que drive.google.com/uc
    return `https://lh3.googleusercontent.com/d/${m[1]}`;
  }
  return trimmed;
}
