import { requireUser } from "@/lib/supabase/server";
import { Sidebar } from "./sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requireUser();
  const { data: conversaciones } = await supabase
    .from("conversaciones")
    .select("id, titulo")
    .order("updated_at", { ascending: false })
    .limit(15);
  const nombre = (user.user_metadata?.full_name as string) || user.email || "";
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <Sidebar userId={user.id} nombre={nombre} email={user.email ?? ""} conversaciones={conversaciones ?? []} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
