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
  return <Link to={to}>{children}</Link>;
}
