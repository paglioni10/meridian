import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Variant = "default" | "primary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  default: "",
  primary: "btn-primary",
  ghost: "btn-ghost",
  danger: "btn-danger",
};

type Common = { variant?: Variant; icon?: boolean };

export function Button({
  variant = "default",
  icon,
  className,
  type = "button",
  ...props
}: Common & ComponentProps<"button">) {
  return (
    <button type={type} className={cn("btn", VARIANTS[variant], icon && "btn-icon", className)} {...props} />
  );
}

export function ButtonLink({
  variant = "default",
  icon,
  className,
  ...props
}: Common & ComponentProps<typeof Link>) {
  return (
    <Link className={cn("btn no-underline", VARIANTS[variant], icon && "btn-icon", className)} {...props} />
  );
}
