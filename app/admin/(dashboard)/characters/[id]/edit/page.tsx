"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import CharacterForm, { CharacterFormValue } from "@/components/admin/CharacterForm";

type DialogueLine = { id: string; textZh: string; textEn: string; order: number; isEnabled: boolean };

export default function EditCharacterPage() {
  const params = useParams<{ id: string }>();
  const [initial, setInitial] = useState<CharacterFormValue | null>(null);
  const [lines, setLines] = useState<DialogueLine[]>([]);
  const [notFound, setNotFound] = useState(false);

  async function load() {
    const res = await fetch(`/api/admin/characters/${params.id}`);
    const data = await res.json();
    if (!data.character) {
      setNotFound(true);
      return;
    }
    setInitial(data.character);
    setLines(data.character.dialogueLines || []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function handleSubmit(value: CharacterFormValue) {
    const res = await fetch(`/api/admin/characters/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error };
    return { ok: true };
  }

  if (notFound) return <p className="text-sm text-ink-400">找不到這個角色。</p>;
  if (!initial) return <p className="text-sm text-ink-400">載入中…</p>;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">編輯｜{initial.name}</h1>
      <div className="mt-6">
        <CharacterForm initial={initial} onSubmit={handleSubmit} />
      </div>
      <div className="mt-10 max-w-xl border-t border-ink-100 dark:border-ink-800 pt-6">
        <DialogueLinesManager characterId={params.id} lines={lines} onChanged={load} />
      </div>
    </div>
  );
}

function DialogueLinesManager({ characterId, lines, onChanged }: { characterId: string; lines: DialogueLine[]; onChanged: () => void }) {
  const [draft, setDraft] = useState({ textZh: "", textEn: "" });

  async function add() {
    if (!draft.textZh.trim()) return;
    await fetch("/api/admin/ip-dialogue-lines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId, ...draft, order: lines.length }),
    });
    setDraft({ textZh: "", textEn: "" });
    onChanged();
  }
  async function update(id: string, data: Partial<DialogueLine>) {
    await fetch(`/api/admin/ip-dialogue-lines/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    onChanged();
  }
  async function remove(id: string) {
    await fetch(`/api/admin/ip-dialogue-lines/${id}`, { method: "DELETE" });
    onChanged();
  }

  const sorted = [...lines].sort((a, b) => a.order - b.order);

  return (
    <div>
      <h2 className="font-display text-lg font-bold">首頁對話回覆</h2>
      <p className="mt-1 text-xs text-ink-400">
        首頁每次點擊這隻角色，會從下面「啟用」的句子裡隨機抽一句顯示——只有一句就固定顯示那句，沒有句子就不會跳出對話框。
      </p>
      <div className="mt-3 space-y-2">
        {sorted.map((l) => (
          <div key={l.id} className="rounded-lg border border-ink-100 dark:border-ink-800 p-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <input
                defaultValue={l.textZh}
                onBlur={(e) => update(l.id, { textZh: e.target.value })}
                placeholder="中文回覆"
                className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-transit-500"
              />
              <button onClick={() => remove(l.id)} className="shrink-0 rounded-lg p-1.5 text-red-400 hover:bg-red-500/10"><Trash2 size={14} /></button>
            </div>
            <input
              defaultValue={l.textEn}
              onBlur={(e) => update(l.id, { textEn: e.target.value })}
              placeholder="English reply"
              className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-transit-500"
            />
            <label className="flex items-center gap-1.5 text-xs text-ink-400">
              <input type="checkbox" checked={l.isEnabled} onChange={(e) => update(l.id, { isEnabled: e.target.checked })} /> 啟用
            </label>
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-1.5 rounded-lg border border-dashed border-ink-100 dark:border-ink-800 p-3">
        <input value={draft.textZh} onChange={(e) => setDraft({ ...draft, textZh: e.target.value })} placeholder="新回覆（中文）" className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-transit-500" />
        <input value={draft.textEn} onChange={(e) => setDraft({ ...draft, textEn: e.target.value })} placeholder="English reply" className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-transit-500" />
        <button onClick={add} className="flex items-center gap-1 rounded-lg bg-transit-500 px-3 py-1.5 text-xs font-medium text-white"><Plus size={14} /> 新增回覆</button>
      </div>
    </div>
  );
}
