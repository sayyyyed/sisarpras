import sdiLogo from "@/lib/image/logo sdi.png";
import { CometSpinner } from "@/components/base/spinner/comet-spinner";

export function AppLoadingScreen({ label = "Menyiapkan aplikasi…" }: { label?: string }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-background-full px-6 text-center">
      <img src={sdiLogo} alt="Logo SDI Kota Blitar" className="size-28 object-contain" />
      <div className="flex flex-col items-center gap-3">
        <CometSpinner className="size-12 text-accent-600 [--duration:1.7s]" />
        <p className="text-body-medium text-text-secondary" aria-live="polite">{label}</p>
      </div>
    </main>
  );
}
