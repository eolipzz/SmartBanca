import Link from "next/link";

export default function NotFound() {
  return <main className="error-page"><div className="error-code">404</div><h1>Essa linha saiu do mercado.</h1><p>A página não existe ou foi movida.</p><Link className="primary-button" href="/">Voltar ao painel</Link></main>;
}
