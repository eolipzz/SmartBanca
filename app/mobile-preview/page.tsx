"use client";

import { useState } from "react";

export default function MobilePreview() {
  const [device, setDevice] = useState<"ios" | "android">("ios");
  const ios = device === "ios";
  return <main className="preview-page"><header><div><h1>SmartBanca mobile</h1><p>Preview responsivo em tamanho real</p></div><div className="device-toggle"><button className={ios?"active":""} onClick={()=>setDevice("ios")}>iPhone 15</button><button className={!ios?"active":""} onClick={()=>setDevice("android")}>Android</button></div></header><section className={`phone-frame ${device}`} style={{"--phone-width":ios?"390px":"412px","--phone-height":ios?"844px":"915px"} as React.CSSProperties}><div className="phone-speaker"/><iframe title={`SmartBanca em ${ios?"iPhone":"Android"}`} src="/login"/></section><p className="preview-hint">Use a alternância acima para comparar os dois formatos.</p></main>;
}
