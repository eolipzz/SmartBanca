"use client";
export default function GlobalError({reset}:{error:Error&{digest?:string};reset:()=>void}){
  return <html lang="pt-BR"><body><main className="error-page"><div className="error-code">!</div><h1>Não foi possível abrir o SmartBanca</h1><p>Recarregue a aplicação. Nenhuma movimentação foi alterada.</p><button className="primary-button" onClick={reset}>Recarregar</button></main></body></html>;
}
