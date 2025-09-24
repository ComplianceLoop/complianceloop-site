import * as React from "react";
export default function Card({children, style}:{children:React.ReactNode, style?:React.CSSProperties}){
  return <div className="card" style={style}>{children}</div>;
}
