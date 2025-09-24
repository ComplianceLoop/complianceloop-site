"use client";
import * as React from "react";
export default function Input(props: React.InputHTMLAttributes<HTMLInputElement>){
  const style: React.CSSProperties = {
    width:"100%", padding:"10px 12px", borderRadius:"10px",
    border:"1px solid rgba(255,255,255,.16)", background:"rgba(255,255,255,.04)",
    color:"var(--color-text)", outline:"none"
  };
  return <input {...props} style={style} />;
}
