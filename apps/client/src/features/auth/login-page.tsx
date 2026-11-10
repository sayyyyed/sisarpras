import { useRef, useState, type FormEvent, type PointerEvent } from "react";
import { Button } from "@/components/base/buttons/button";
import { InputOtp } from "@/components/base/input-otp/input-otp";
import { Panel } from "@/components/ui/primitives";
import { useAuth } from "@/lib/auth";
import sdiLogo from "@/lib/image/logo sdi.png";
import Aurora from "@/components/base/backgrounds/aurora";
import { ThemeToggle, useThemeMode } from "@/components/application/theme/theme-toggle";
import "./login-page.css";

export function LoginPage() {
  const { login } = useAuth();
  const theme = useThemeMode();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  function moveAurora(event: PointerEvent<HTMLElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    backdropRef.current?.style.setProperty("--aurora-pointer-x", `${event.clientX - bounds.left}px`);
    backdropRef.current?.style.setProperty("--aurora-pointer-y", `${event.clientY - bounds.top}px`);
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { if (!await login(pin)) setError("PIN tidak cocok. Silakan coba lagi."); }
    finally { setBusy(false); }
  }
  async function complete(value: string) {
    setPin(value); setBusy(true); setError("");
    try { if (!await login(value)) setError("PIN tidak cocok. Silakan coba lagi."); }
    finally { setBusy(false); }
  }
  return <main onPointerMove={moveAurora} className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-background-full px-4 py-8">
    <ThemeToggle collapsed className="fixed right-4 top-4 z-20 border border-border-button-default bg-background-primary-default shadow-xs sm:right-6 sm:top-6" />
    <div ref={backdropRef} aria-hidden="true" className="login-aurora-backdrop pointer-events-none absolute inset-0">
      <Aurora
        colorStops={theme === "dark" ? ["#7665FF", "#39C6BB", "#608BFF"] : ["#3B82F6", "#22A699", "#60A5FA"]}
        amplitude={0.8}
        blend={0.55}
        speed={0.45}
        height={0.48}
        scale={0.9}
        glow={0.45}
        brightness={0.85}
        layers={1}
        mouseInteraction
        lightMode={theme === "light"}
        dpr={1}
      />
    </div>
    <div className="relative z-10 w-full max-w-[420px]">
      <Panel className="p-6 sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src={sdiLogo} alt="Logo SDI Kota Blitar" className="size-16 object-contain" />
          <h1 className="mt-6 text-title-2-medium text-text-primary">Sistem Manajemen Sarpras</h1>
          <p className="mt-1 text-body-regular text-text-secondary">Gunakan PIN akun Anda untuk melanjutkan.</p>
        </div>
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <div className="flex flex-col gap-1.5">
            <InputOtp value={pin} onChange={setPin} onComplete={(value) => void complete(value)} length={6} isInvalid={Boolean(error)} aria-label="PIN enam digit" className="justify-center" />
          </div>
          {error && <p role="alert" className="text-body-2-regular text-text-error-primary">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy || pin.length !== 6}>{busy ? "Memeriksa…" : "Masuk"}</Button>
        </form>
      </Panel>
    </div>
  </main>;
}
