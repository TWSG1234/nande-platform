"use client";

import CharacterForm, { CharacterFormValue } from "@/components/admin/CharacterForm";

export default function NewCharacterPage() {
  async function handleSubmit(value: CharacterFormValue) {
    const res = await fetch("/api/admin/characters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error };
    return { ok: true };
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">新增 IP 角色</h1>
      <div className="mt-6">
        <CharacterForm onSubmit={handleSubmit} submitLabel="新增" />
      </div>
    </div>
  );
}
