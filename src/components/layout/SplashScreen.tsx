import { useEffect, useState } from "react";
import introAudio from "@/assets/intro-audio.wav";

const SPLASH_KEY = "salgon_splash_shown";
const SPLASH_DURATION = 2800;

export function SplashScreen({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window === "undefined") return;
    const alreadyShown = sessionStorage.getItem(SPLASH_KEY);
    if (alreadyShown) return;
    setShow(true);
    sessionStorage.setItem(SPLASH_KEY, "1");

    const audio = new Audio(introAudio);
    audio.volume = 0.9;
    audio.play().catch(() => {
      /* autoplay blocked — ignore */
    });

    const t = setTimeout(() => setShow(false), SPLASH_DURATION);
    return () => {
      clearTimeout(t);
      audio.pause();
    };
  }, []);

  return (
    <>
      {children}
      {mounted && show && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-background animate-in fade-in"
          style={{ animation: "splashFadeOut 400ms ease-in forwards", animationDelay: `${SPLASH_DURATION - 400}ms` }}
        >
          <style>{`
            @keyframes splashFadeOut { to { opacity: 0; visibility: hidden; } }
            @keyframes splashLogo {
              0% { opacity: 0; transform: scale(0.85); }
              40% { opacity: 1; transform: scale(1); }
              100% { opacity: 1; transform: scale(1); }
            }
          `}</style>
          <div className="flex flex-col items-center gap-4" style={{ animation: "splashLogo 1.2s ease-out both" }}>
            <img
              src="/salgon-logo.png"
              alt="Salgon"
              className="h-28 w-28 rounded-2xl object-cover shadow-2xl"
            />
            <div className="text-center">
              <div className="text-2xl font-semibold tracking-tight text-foreground">Salgon</div>
              <div className="text-xs text-muted-foreground mt-1">Suite Inmobiliaria</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
