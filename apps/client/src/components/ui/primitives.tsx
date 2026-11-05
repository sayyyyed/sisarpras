import type { ReactNode } from "react";
import { cx } from "@/utils/cx";

/**
 * Layout wrappers carrying BoardUI's card recipe
 * (`rounded-3xl border border-border-button-default bg-background-primary-default`).
 * Everything interactive comes from installed BoardUI components.
 */

export function PageHeading({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-title-1-medium text-text-primary">{title}</h1>
        {subtitle && <p className="mt-1 text-body-regular text-text-secondary">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionHeading({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-title-2-medium text-text-primary">{title}</h2>
        {subtitle && <p className="mt-0.5 text-body-regular text-text-secondary">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Panel({
  children,
  className,
  padded = false,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={cx(
        "rounded-3xl border border-border-button-default bg-background-primary-default",
        padded && "p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function LabelledRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-caption-1-regular text-text-tertiary">{label}</span>
      <span className="text-body-medium text-text-primary">{children}</span>
    </div>
  );
}

export function MonoCode({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md border border-border-button-default bg-background-secondary-default px-1.5 py-0.5 font-mono text-caption-1-regular text-text-secondary">
      {children}
    </span>
  );
}
