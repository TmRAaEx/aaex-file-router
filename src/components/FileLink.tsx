import React from "react";
import { Link, useLocation } from "react-router-dom";

interface FileLinkProps<RouteType extends string = string>
  extends React.PropsWithChildren {
  to: RouteType;
  activeClassName?: string;
  className?: string;
}

export function FileLink<RouteType extends string = string>({
  to,
  children,
  activeClassName = "active",
  className = "",
}: FileLinkProps<RouteType>) {
  const isServer = typeof window === "undefined";

  if (isServer) {
    // SSR fallback
    return <a href={to as string}>{children}</a>;
  }

  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to as string}
      className={`${className} ${isActive ? activeClassName : ""}`.trim()}
    >
      {children}
    </Link>
  );
}
