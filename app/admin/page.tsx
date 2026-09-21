import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AdminPanel } from "@/components/admin-panel";

export const metadata = { title: "Administração" };
export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/");
  return <AdminPanel/>;
}
