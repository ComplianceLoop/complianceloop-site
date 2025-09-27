// components/ui/button.tsx
"use client";
import * as React from "react";
import { cn } from "@/lib/cn";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "brand" | "ghost" };

export function Button({ className, variant = "brand", ...props }: Props) {
  const cls = cn("cl-btn", variant === "brand" ? "cl-btn-brand" : "hover:bg-muted", className);
  return <button className={cls} {...props} />;
}
export default Button;
