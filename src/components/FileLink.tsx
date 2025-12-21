import React from "react";
import { Link } from "react-router-dom";

interface FileLinkProps<RouteType extends string = string> {
  to: RouteType;
  children: React.ReactNode;
}

export function FileLink<RouteType extends string = string>({
  to,
  children,
}: FileLinkProps<RouteType>) {
  const isServer = typeof window === "undefined";

  if (isServer) {
    //supports server side routing 
    return <a href={to as string}>{children}</a>;
  }
  // client side routing
  return <Link to={to as string}>{children}</Link>;
}
