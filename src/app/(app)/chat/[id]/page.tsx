import type { UIMessage } from "ai";
import { notFound } from "next/navigation";
import { Chat } from "@/components/chat/chat";
import { conIds } from "@/lib/chat/titulo";
import { requireUser } from "@/lib/supabase/server";

export default async function ConversacionPage({ params }: PageProps<"/chat/[id]">) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const [{ data: conv }, { count }, { data: dashboards }] = await Promise.all([
    supabase.from("conversaciones").select("id, titulo, mensajes").eq("id", id).maybeSingle(),
    supabase.from("datasets").select("id", { count: "exact", head: true }),
    supabase.from("dashboards").select("id, nombre").order("updated_at", { ascending: false }),
  ]);
  if (!conv) notFound();
  return (
    <Chat
      key={conv.id}
      id={conv.id}
      titulo={conv.titulo}
      inicial={conIds(conv.mensajes as UIMessage[])}
      hayDatos={(count ?? 0) > 0}
      dashboards={dashboards ?? []}
    />
  );
}
