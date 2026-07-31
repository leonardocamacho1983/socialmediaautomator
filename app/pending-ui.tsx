"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type MouseEvent,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { flushSync, useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

type NavigationFeedbackContextValue = {
  pendingHref: string | null;
  navigate: (href: string, label: string) => void;
};

const NavigationFeedbackContext =
  createContext<NavigationFeedbackContextValue | null>(null);

export function NavigationFeedbackProvider({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isRouterPending, startTransition] = useTransition();
  const [pendingNavigation, setPendingNavigation] = useState<{
    href: string;
    label: string;
  } | null>(null);

  useEffect(() => {
    setPendingNavigation(null);
  }, [pathname]);

  const value = useMemo<NavigationFeedbackContextValue>(
    () => ({
      pendingHref: pendingNavigation?.href ?? null,
      navigate(href, label) {
        flushSync(() => {
          setPendingNavigation({ href, label });
        });
        startTransition(() => {
          router.push(href);
        });
      },
    }),
    [pendingNavigation?.href, router, startTransition],
  );

  const busy = Boolean(pendingNavigation) || isRouterPending;

  return (
    <NavigationFeedbackContext.Provider value={value}>
      {children}
      {busy ? (
        <div aria-live="polite" aria-atomic="true">
          <div className="fixed inset-x-0 top-0 z-50 h-1 overflow-hidden bg-teal-300/10">
            <div className="h-full w-1/3 animate-[route-progress_1.1s_ease-in-out_infinite] bg-teal-200 shadow-[0_0_24px_rgba(94,234,212,0.65)]" />
          </div>
          <div className="fixed right-4 top-4 z-50 inline-flex items-center gap-2 rounded-lg border border-teal-300/25 bg-zinc-950/90 px-3 py-2 text-sm font-semibold text-teal-50 shadow-2xl shadow-black/30 backdrop-blur">
            <Loader2 className="size-4 animate-spin" />
            {pendingNavigation?.label ?? "Carregando"}
          </div>
        </div>
      ) : null}
    </NavigationFeedbackContext.Provider>
  );
}

type AppLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  pendingLabel?: string;
  activeClassName?: string;
};

export function AppLink({
  href,
  children,
  className,
  activeClassName,
  pendingLabel,
  onClick,
  target,
  ...props
}: AppLinkProps) {
  const pathname = usePathname();
  const feedback = useContext(NavigationFeedbackContext);
  const hrefPath = href.split(/[?#]/)[0] || "/";
  const isActive = hrefPath === pathname;
  const isPending = feedback?.pendingHref === href;
  const resolvedClassName = [className, isActive ? activeClassName : ""]
    .filter(Boolean)
    .join(" ");

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);

    if (
      event.defaultPrevented ||
      !feedback ||
      target ||
      href.startsWith("#") ||
      href.startsWith("http") ||
      isModifiedClick(event)
    ) {
      return;
    }

    event.preventDefault();

    if (hrefPath === pathname) {
      return;
    }

    feedback?.navigate(href, pendingLabel ?? "Abrindo pagina");
  }

  return (
    <Link
      href={href}
      className={resolvedClassName}
      aria-current={isActive ? "page" : undefined}
      aria-busy={isPending || undefined}
      onClick={handleClick}
      target={target}
      {...props}
    >
      {isPending ? (
        <Loader2 className="mr-2 inline size-4 shrink-0 animate-spin align-[-2px]" />
      ) : null}
      {children}
    </Link>
  );
}

type PendingSubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingLabel?: string;
};

export function PendingSubmitButton({
  children,
  className,
  disabled,
  pendingLabel = "Executando",
  ...props
}: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      {...props}
      className={className}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
    >
      {pending ? (
        <>
          <Loader2 className="size-4 shrink-0 animate-spin" />
          <span>{pendingLabel}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function FormPendingNotice({
  label = "Processando. Aguarde a resposta antes de clicar de novo.",
}: {
  label?: string;
}) {
  const { pending } = useFormStatus();

  if (!pending) {
    return null;
  }

  return (
    <p className="mt-3 inline-flex items-center gap-2 rounded-lg border border-teal-300/20 bg-teal-300/10 px-3 py-2 text-xs font-semibold text-teal-50">
      <Loader2 className="size-3.5 animate-spin" />
      {label}
    </p>
  );
}

function isModifiedClick(event: MouseEvent<HTMLAnchorElement>) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}
