import { Chat } from "@/components/chat/chat";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "Chat · Insight" };

export default async function NuevoChatPage() {
  const { supabase } = await requireUser();
  const [{ count }, { data: dashboards }] = await Promise.all([
    supabase.from("datasets").select("id", { count: "exact", head: true }),
    supabase.from("dashboards").select("id, nombre").order("updated_at", { ascending: false }),
  ]);
  // Cada visita a /chat es una conversación nueva: el id lo genera el servidor.
  return <Chat key={crypto.randomUUID()} id={crypto.randomUUID()} inicial={[]} hayDatos={(count ?? 0) > 0} dashboards={dashboards ?? []} />;
}
