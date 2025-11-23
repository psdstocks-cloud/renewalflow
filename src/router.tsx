import React, { createContext, ReactElement, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

interface RouterContextValue {
  pathname: string;
  navigate: (to: string, options?: { replace?: boolean }) => void;
}

const RouterContext = createContext<RouterContextValue | undefined>(undefined);

function useRouterContext() {
  const ctx = useContext(RouterContext);
  if (!ctx) {
    throw new Error('useRouterContext must be used within a BrowserRouter');
  }
  return ctx;
}

export function BrowserRouter({ children }: { children: ReactNode }) {
  const [pathname, setPathname] = useState(() => window.location.pathname || '/');

  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname || '/');
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (to: string, options?: { replace?: boolean }) => {
    if (options?.replace) {
      window.history.replaceState(null, '', to);
    } else {
      window.history.pushState(null, '', to);
    }
    setPathname(to);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const value = useMemo(() => ({ pathname, navigate }), [pathname]);

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function Routes({ children }: { children: ReactNode }) {
  const { pathname } = useRouterContext();

  let element: ReactNode = null;

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const route = child as ReactElement<RouteProps>;
    if (matchPath(route.props.path, pathname)) {
      element = route.props.element;
    }
  });

  return <>{element}</>;
}

export interface RouteProps {
  path: string;
  element: ReactNode;
}

export function Route(_props: RouteProps) {
  return null;
}

function normalize(path: string) {
  if (!path.startsWith('/')) return `/${path}`;
  return path.replace(/\/$/, '') || '/';
}

function matchPath(routePath: string, currentPath: string) {
  return normalize(routePath) === normalize(currentPath);
}

export function Navigate({ to, replace }: { to: string; replace?: boolean }) {
  const { navigate } = useRouterContext();
  useEffect(() => {
    navigate(to, { replace });
  }, [navigate, replace, to]);
  return null;
}

export function Link({ to, className, children, onClick }: { to: string; className?: string; children: ReactNode; onClick?: React.MouseEventHandler<HTMLAnchorElement>; }) {
  const { navigate } = useRouterContext();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    onClick?.(e);
    navigate(to);
  };

  return (
    <a href={to} onClick={handleClick} className={className}>
      {children}
    </a>
  );
}

export function useNavigate() {
  const { navigate } = useRouterContext();
  return navigate;
}

export function useLocation() {
  const { pathname } = useRouterContext();
  return { pathname };
}

export function useSearchParams() {
  const [search, setSearch] = useState(() => window.location.search);
  
  useEffect(() => {
    const handlePopState = () => setSearch(window.location.search);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const searchParams = useMemo(() => {
    return new URLSearchParams(search);
  }, [search]);

  const setSearchParams = (updater: URLSearchParams | ((prev: URLSearchParams) => URLSearchParams), options?: { replace?: boolean }) => {
    const newParams = typeof updater === 'function' ? updater(searchParams) : updater;
    const newSearch = newParams.toString();
    const newUrl = `${window.location.pathname}${newSearch ? `?${newSearch}` : ''}${window.location.hash}`;
    
    if (options?.replace) {
      window.history.replaceState(null, '', newUrl);
    } else {
      window.history.pushState(null, '', newUrl);
    }
    setSearch(newSearch);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return [searchParams, setSearchParams] as const;
}
