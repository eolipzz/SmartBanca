"use client";
import { useEffect } from "react";

export default function ErrorPage({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
  useEffect(()=>{console.error("SmartBanca error",error.digest??"sem-digest")},[error]);
  return <main className="error-page"><div className="error-code">!</div><h1>O painel encontrou um problema</h1><p>Seus dados continuam seguros. Tente carregar esta área novamente.</p><button className="primary-button" onClick={reset}>Tentar novamente</button></main>;
}
