import PDFDocument from "pdfkit";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { withUser } from "@/lib/db";

export const runtime = "nodejs";

type Movement = { occurred_at: string | Date; type: "deposit" | "withdrawal"; amount: string | number; note: string | null };
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

function drawPageHeader(doc: PDFKit.PDFDocument, name: string) {
  doc.rect(0, 0, 595, 842).fill("#0b0d10");
  doc.fillColor("#f04444").font("Helvetica-Bold").fontSize(22).text("SmartBanca", 48, 42);
  doc.fillColor("#f4f5f7").fontSize(25).text("Extrato de movimentações", 48, 87);
  doc.fillColor("#9298a3").font("Helvetica").fontSize(10).text(name, 48, 123);
  doc.moveTo(48, 151).lineTo(547, 151).strokeColor("#30343c").stroke();
  doc.fillColor("#777e89").fontSize(8).text("DATA", 48, 168).text("MOVIMENTAÇÃO", 160, 168).text("DESCRIÇÃO", 280, 168).text("VALOR", 450, 168, { width: 97, align: "right" });
  doc.moveTo(48, 184).lineTo(547, 184).strokeColor("#30343c").stroke();
}

function drawFooter(doc: PDFKit.PDFDocument, page: number) {
  doc.fillColor("#6f7682").font("Helvetica").fontSize(8).text(`Página ${page} - Extrato gerado pelo SmartBanca`, 48, 800, { width: 499, align: "center" });
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const data = await withUser(session.id, async client => {
    const [user, transactions] = await Promise.all([
      client.query<{ name: string }>("SELECT name FROM app_user WHERE id=$1", [session.id]),
      client.query<Movement>("SELECT occurred_at,type,amount,note FROM bank_transaction WHERE user_id=$1 ORDER BY occurred_at DESC", [session.id])
    ]);
    return { name: user.rows[0]?.name ?? "Usuário", transactions: transactions.rows };
  });

  const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: "Extrato de movimentações - SmartBanca" } });
  const chunks: Buffer[] = [];
  doc.on("data", chunk => chunks.push(chunk));
  const done = new Promise<Buffer>(resolve => doc.on("end", () => resolve(Buffer.concat(chunks))));
  let page = 1;
  let y = 202;
  drawPageHeader(doc, data.name);

  if (data.transactions.length === 0) {
    doc.fillColor("#a7adb7").font("Helvetica").fontSize(12).text("Nenhum depósito ou saque registrado.", 48, 225, { width: 499, align: "center" });
  } else {
    for (const movement of data.transactions) {
      const description = movement.note?.trim() || (movement.type === "deposit" ? "Depósito" : "Saque");
      const rowHeight = Math.max(45, doc.heightOfString(description, { width: 155 }) + 24);
      if (y + rowHeight > 775) {
        drawFooter(doc, page);
        doc.addPage();
        page += 1;
        drawPageHeader(doc, data.name);
        y = 202;
      }
      const deposit = movement.type === "deposit";
      doc.fillColor("#b5bbc5").font("Helvetica").fontSize(9).text(dateTime.format(new Date(movement.occurred_at)), 48, y, { width: 105 });
      doc.fillColor(deposit ? "#62d997" : "#ff777f").font("Helvetica-Bold").text(deposit ? "Depósito" : "Saque", 160, y, { width: 105 });
      doc.fillColor("#e4e7eb").font("Helvetica").text(description, 280, y, { width: 155 });
      doc.fillColor(deposit ? "#62d997" : "#ff777f").font("Helvetica-Bold").text(`${deposit ? "+ " : "- "}${brl.format(Number(movement.amount))}`, 450, y, { width: 97, align: "right" });
      doc.moveTo(48, y + rowHeight - 10).lineTo(547, y + rowHeight - 10).strokeColor("#22262d").stroke();
      y += rowHeight;
    }
  }
  drawFooter(doc, page);
  doc.end();
  const pdf = await done;
  return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=smartbanca-movimentacoes.pdf", "Cache-Control": "private, no-store" } });
}
