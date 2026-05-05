import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import introAudio from "@/assets/intro-audio.wav";

const SPLASH_DURATION = 2800;

export function SplashScreen({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let currentAudio: HTMLAudioElement | undefined;

    const play = () => {
      setShow(true);
      currentAudio = new Audio(introAudio);
      currentAudio.volume = 0.9;
      currentAudio.play().catch(() => {
        /* autoplay blocked — splash still shows */
      });
      clearTimeout(timer);
      timer = setTimeout(() => setShow(false), SPLASH_DURATION);
    };

    // Play once on initial mount (cold load with existing session)
    const FLAG = "salgon_splash_shown";
    if (!sessionStorage.getItem(FLAG)) {
      sessionStorage.setItem(FLAG, "1");
      play();
    }

    // Replay on every SIGNED_IN event (login, regardless of role)
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        play();
      } else if (event === "SIGNED_OUT") {
        sessionStorage.removeItem(FLAG);
      }
    });

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timer);
      currentAudio?.pause();
    };
  }, []);

  return (
    <>
      {children}
      {show && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-background"
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
