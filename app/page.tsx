import { Dashboard } from "@/components/dashboard";
import { getSession } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await withUser(session.id, async client => (await client.query<{ name: string; email: string; has_avatar: boolean }>("SELECT name,email,avatar_data IS NOT NULL AS has_avatar FROM app_user WHERE id=$1", [session.id])).rows[0]);
  if (!user) redirect("/login");
  return <Dashboard initialUser={{ name: user.name, email: user.email, hasAvatar: user.has_avatar }} />;
}
