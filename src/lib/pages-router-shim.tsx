import type { AnchorHTMLAttributes, ReactNode } from "react";
import { useEffect, useState } from "react";

type NavigateOptions = {
  to?: string;
  href?: string;
  replace?: boolean;
};

function getCurrentLocation() {
  if (typeof window === "undefined") {
    return { pathname: "/", search: "", hash: "", href: "/" };
  }
  return {
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
    href: window.location.pathname + window.location.search + window.location.hash,
  };
}

function normalizeTarget(to?: string, href?: string) {
  const target = to || href || "/";
  if (
    target.startsWith("http://") ||
    target.startsWith("https://") ||
    target.startsWith("mailto:") ||
    target.startsWith("tel:")
  ) {
    return target;
  }
  return target.startsWith("/") ? target : `/${target}`;
}

export function navigateTo(to: string, replace = false) {
  if (typeof window === "undefined") return;
  const target = normalizeTarget(to);
  if (
    target.startsWith("http://") ||
    target.startsWith("https://") ||
    target.startsWith("mailto:") ||
    target.startsWith("tel:")
  ) {
    window.location.href = target;
    return;
  }
  if (replace) window.history.replaceState(null, "", target);
  else window.history.pushState(null, "", target);
  window.dispatchEvent(new Event("popstate"));
  window.scrollTo({ top: 0, left: 0 });
}

export function useNavigate() {
  return (options: string | NavigateOptions) => {
    if (typeof options === "string") {
      navigateTo(options);
      return;
    }
    navigateTo(normalizeTarget(options.to, options.href), !!options.replace);
  };
}

export function useLocation<T = ReturnType<typeof getCurrentLocation>>(options?: {
  select?: (location: ReturnType<typeof getCurrentLocation>) => T;
}) {
  const [location, setLocation] = useState(getCurrentLocation);
  useEffect(() => {
    function handle() {
      setLocation(getCurrentLocation());
    }
    window.addEventListener("popstate", handle);
    return () => window.removeEventListener("popstate", handle);
  }, []);
  return options?.select ? options.select(location) : (location as T);
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  to?: string;
  href?: string;
  children?: ReactNode;
  preload?: unknown;
  activeProps?: unknown;
  inactiveProps?: unknown;
  search?: unknown;
  params?: unknown;
  replace?: boolean;
};

export function Link({
  to,
  href,
  children,
  onClick,
  preload: _preload,
  activeProps: _activeProps,
  inactiveProps: _inactiveProps,
  search: _search,
  params: _params,
  replace,
  ...props
}: LinkProps) {
  const target = normalizeTarget(to, href);
  return (
    <a
      {...props}
      href={target}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          event.button !== 0
        ) {
          return;
        }
        if (
          target.startsWith("http://") ||
          target.startsWith("https://") ||
          target.startsWith("mailto:") ||
          target.startsWith("tel:")
        ) {
          return;
        }
        event.preventDefault();
        navigateTo(target, !!replace);
      }}
    >
      {children}
    </a>
  );
}

export function createFileRoute(path: string) {
  return (options: any) => ({
    path,
    options,
    component: options.component,
    beforeLoad: options.beforeLoad,
    useRouteContext: () => ({ queryClient: undefined as any }),
  });
}

export function createRootRouteWithContext<_T = unknown>() {
  return (options: any) => ({
    path: "/",
    options,
    component: options.component,
    useRouteContext: () => ({}),
  });
}

export function createRootRoute(options: any) {
  return {
    path: "/",
    options,
    component: options.component,
    useRouteContext: () => ({}),
  };
}

export function Outlet() {
  return null;
}

export function HeadContent() {
  return null;
}

export function Scripts() {
  return null;
}

export function useRouter() {
  return {
    invalidate: () => undefined,
    navigate: (options: string | NavigateOptions) => {
      if (typeof options === "string") navigateTo(options);
      else navigateTo(normalizeTarget(options.to, options.href), !!options.replace);
    },
  };
}

export class RedirectError {
  constructor(public to: string, public replace = true) {}
}

export function redirect(options: { to?: string; href?: string; replace?: boolean }) {
  return new RedirectError(normalizeTarget(options.to, options.href), options.replace ?? true);
}

export function createRouter(_config: any) {
  return {};
}

export function RouterProvider(_props: any) {
  return null;
}

