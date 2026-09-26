"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function ModoLogin({ password, magic }: { password: React.ReactNode; magic: React.ReactNode }) {
  const [modo, setModo] = useState<"password" | "magic">("password");
  return (
    <div>
      <div role="tablist" aria-label="Forma de entrar" className="mb-6 grid grid-cols-2 rounded-full border border-line p-1 text-sm">
        {(
          [
            ["password", "Contraseña"],
            ["magic", "Link por email"],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={modo === m}
            onClick={() => setModo(m)}
            className={cn(
              "rounded-full py-2 transition-colors",
              modo === m ? "bg-ink text-paper" : "text-ink-2 hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{modo === "password" ? password : magic}</div>
    </div>
  );
}
