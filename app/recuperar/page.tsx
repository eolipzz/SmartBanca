import { Suspense } from "react";
import { RecoveryForm } from "@/components/recovery-form";
export default function RecoveryPage(){return <Suspense fallback={<main className="loading-screen"><p>Carregando…</p></main>}><RecoveryForm/></Suspense>}
