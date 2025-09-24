"use client";
import * as React from "react";
type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary"|"ghost"|"danger" };
export default function Button({variant="primary", style, ...props}:Props){
  const base = {
    padding: "10px 14px",
    borderRadius: "12px",
    border: "1px solid transparent",
    cursor: "pointer",
    transition: "transform .02s ease, background .15s ease, border-color .15s ease",
    fontWeight: 600
  } as React.CSSProperties;
  const variants: Record<string, React.CSSProperties> = {
    primary: { background: "var(--color-primary)", color:"#fff" },
    ghost:   { background: "transparent", color:"var(--color-text)", borderColor:"rgba(255,255,255,.16)" },
    danger:  { background: "var(--color-danger)", color:"#fff" }
  };
  return <button {...props} style={{...base, ...variants[variant], ...style}} onMouseDown={(e)=>{(e.currentTarget as HTMLButtonElement).style.transform="scale(.98)"}} onMouseUp={(e)=>{(e.currentTarget as HTMLButtonElement).style.transform="scale(1)"}} />;
}
