import { PRIVACY_NOTICE } from "@/content/privacy-notice";

/** Renderiza el texto del Aviso de Privacidad. Reutilizado por la ruta pública y el gate. */
export function PrivacyNoticeContent() {
  return (
    <article className="space-y-6 text-sm leading-relaxed text-foreground">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{PRIVACY_NOTICE.title}</h1>
        <p className="text-xs text-muted-foreground">
          Última actualización: {PRIVACY_NOTICE.lastUpdated}
        </p>
      </header>

      {PRIVACY_NOTICE.intro.map((p, i) => (
        <p key={`intro-${i}`} className="text-muted-foreground">
          {p}
        </p>
      ))}

      {PRIVACY_NOTICE.sections.map((section) => (
        <section key={section.heading} className="space-y-2">
          <h2 className="text-base font-semibold tracking-tight">{section.heading}</h2>
          {section.paragraphs.map((p, i) => (
            <p key={`${section.heading}-${i}`} className="text-muted-foreground">
              {p}
            </p>
          ))}
        </section>
      ))}
    </article>
  );
}
