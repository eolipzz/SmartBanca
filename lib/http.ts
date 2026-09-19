import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { randomUUID } from "node:crypto";

export function apiError(error: unknown) {
  if (error instanceof ZodError) return NextResponse.json({ error: "Dados inválidos.", fields: error.flatten().fieldErrors }, { status: 422 });
  const errorId=randomUUID();
  console.error(JSON.stringify({level:"error",errorId,kind:error instanceof Error?error.name:"UnknownError",at:new Date().toISOString()}));
  if (process.env.NODE_ENV !== "production") console.error(error);
  return NextResponse.json({ error: "Não foi possível concluir a solicitação.", errorId }, { status: 500 });
}
