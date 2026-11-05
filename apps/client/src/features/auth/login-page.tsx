import { useState, type FormEvent } from "react";
import { RiBuildingLine } from "@remixicon/react";
import { Button } from "@/components/base/buttons/button";
import { InputOtp } from "@/components/base/input-otp/input-otp";
import { Panel } from "@/components/ui/primitives";
import { useAuth } from "@/lib/auth";

export function LoginPage() {
  const { login } = useAuth();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
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
  return <main className="flex min-h-dvh items-center justify-center bg-background-full px-4 py-8">
    <div className="w-full max-w-[420px]">
      <div className="mb-6 flex items-center justify-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-accent-100 text-accent-700"><RiBuildingLine className="size-6" /></span>
        <div><p className="text-title-3-semibold text-text-primary">Sisarpras</p><p className="text-body-2-regular text-text-secondary">Manajemen sarana & prasarana</p></div>
      </div>
      <Panel className="p-6 sm:p-8">
        <div className="mb-6 text-center"><h1 className="text-title-2-medium text-text-primary">Masuk dengan PIN</h1><p className="mt-1 text-body-regular text-text-secondary">Gunakan PIN akun Anda untuk melanjutkan.</p></div>
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <div className="flex flex-col gap-1.5">
            <span className="text-body-medium text-text-primary">PIN</span>
            <InputOtp value={pin} onChange={setPin} onComplete={(value) => void complete(value)} length={6} isInvalid={Boolean(error)} aria-label="PIN enam digit" className="justify-center" />
          </div>
          {error && <p role="alert" className="text-body-2-regular text-text-error-primary">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy || pin.length !== 6}>{busy ? "Memeriksa…" : "Masuk"}</Button>
        </form>
      </Panel>
      <p className="mt-4 text-center text-caption-1-regular text-text-tertiary">Akun admin awal menggunakan PIN 898851</p>
    </div>
  </main>;
}
