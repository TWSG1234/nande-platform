"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import ImageUploader from "@/components/admin/ImageUploader";
import StatusBanner, { StatusMessage } from "@/components/admin/StatusBanner";
import BilingualField from "@/components/admin/BilingualField";
import type { EnglishSource } from "@/lib/translationService";

const inputClass = "w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-2 text-sm outline-none focus:border-transit-500";

export default function AdminAboutPage() {
  return (
    <div className="space-y-12">
      <h1 className="font-display text-2xl font-bold">關於我們</h1>
      <MissionSection />
      <ExtraSections />
      <TeamSection />
      <PartnersSection />
      <ContactSection />
    </div>
  );
}

type MissionValue = { titleZh: string; titleEn: string; titleEnSource: EnglishSource; contentZh: string; contentEn: string; contentEnSource: EnglishSource };

function MissionSection() {
  const [value, setValue] = useState<MissionValue | null>(null);
  const [status, setStatus] = useState<StatusMessage>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/about")
      .then((r) => r.json())
      .then((d) => {
        const a = d.about;
        setValue({
          titleZh: a.titleZh || "",
          titleEn: a.titleEn || "",
          titleEnSource: a.titleEnSource || "AUTO",
          contentZh: a.contentZh || "",
          contentEn: a.contentEn || "",
          contentEnSource: a.contentEnSource || "AUTO",
        });
      });
  }, []);

  async function save() {
    if (!value) return;
    setSaving(true);
    // 只送「理念」欄位；英文由 BilingualField 標記為手動輸入，後端不會用中文覆蓋
    const res = await fetch("/api/admin/about", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
    setSaving(false);
    setStatus(res.ok ? { type: "success", text: "儲存成功！" } : { type: "error", text: "儲存失敗，請確認標題與內容已填寫。" });
  }

  return (
    <section>
      <h2 className="font-display text-lg font-bold">網站理念（第一段，固定顯示在最前面）</h2>
      <div className="mt-3"><StatusBanner status={status} /></div>
      {!value ? (
        <p className="mt-3 text-sm text-ink-400">載入中…</p>
      ) : (
        <div className="mt-3 max-w-2xl space-y-3">
          <BilingualField labelZh="標題（中文）" labelEn="Title (English)" required value={{ zh: value.titleZh, en: value.titleEn, source: value.titleEnSource }} onChange={(n) => setValue({ ...value, titleZh: n.zh, titleEn: n.en, titleEnSource: n.source })} />
          <BilingualField labelZh="內容（中文）" labelEn="Content (English)" required multiline value={{ zh: value.contentZh, en: value.contentEn, source: value.contentEnSource }} onChange={(n) => setValue({ ...value, contentZh: n.zh, contentEn: n.en, contentEnSource: n.source })} />
          <button onClick={save} disabled={saving} className="rounded-lg bg-transit-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {saving ? "儲存中…" : "儲存"}
          </button>
        </div>
      )}
    </section>
  );
}

type Section = { id: string; titleZh: string; titleEn: string; contentZh: string; contentEn: string; order: number; isVisible: boolean };

function ExtraSections() {
  const [items, setItems] = useState<Section[]>([]);
  const [draft, setDraft] = useState({ titleZh: "", titleEn: "", contentZh: "", contentEn: "" });

  async function load() {
    const d = await fetch("/api/admin/about-sections").then((r) => r.json());
    setItems(d.sections);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!draft.contentZh.trim()) return;
    await fetch("/api/admin/about-sections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, order: items.length }) });
    setDraft({ titleZh: "", titleEn: "", contentZh: "", contentEn: "" });
    load();
  }
  async function update(id: string, data: Partial<Section>) {
    await fetch(`/api/admin/about-sections/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    load();
  }
  async function move(item: Section, dir: -1 | 1) {
    const sorted = [...items].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((s) => s.id === item.id);
    const swap = sorted[idx + dir];
    if (!swap) return;
    await Promise.all([update(item.id, { order: swap.order }), update(swap.id, { order: item.order })]);
  }
  async function remove(id: string) {
    await fetch(`/api/admin/about-sections/${id}`, { method: "DELETE" });
    load();
  }

  const sorted = [...items].sort((a, b) => a.order - b.order);

  return (
    <section>
      <h2 className="font-display text-lg font-bold">額外段落（可新增/刪除/排序）</h2>
      <div className="mt-3 max-w-xl space-y-3">
        {sorted.map((s, i) => (
          <div key={s.id} className="rounded-lg border border-ink-100 dark:border-ink-800 p-3">
            <div className="flex items-center gap-2">
              <div className="flex flex-col">
                <button onClick={() => move(s, -1)} disabled={i === 0} className="p-0.5 text-ink-400 disabled:opacity-20"><ArrowUp size={13} /></button>
                <button onClick={() => move(s, 1)} disabled={i === sorted.length - 1} className="p-0.5 text-ink-400 disabled:opacity-20"><ArrowDown size={13} /></button>
              </div>
              <input defaultValue={s.titleZh} onBlur={(e) => update(s.id, { titleZh: e.target.value })} placeholder="段落標題（中文，選填）" className={inputClass} />
              <input defaultValue={s.titleEn} onBlur={(e) => update(s.id, { titleEn: e.target.value })} placeholder="Title (English, optional)" className={inputClass} />
              <button onClick={() => remove(s.id)} className="shrink-0 rounded-lg p-1.5 text-red-400 hover:bg-red-500/10"><Trash2 size={14} /></button>
            </div>
            <textarea defaultValue={s.contentZh} onBlur={(e) => update(s.id, { contentZh: e.target.value })} placeholder="內容（中文）" rows={2} className={`${inputClass} mt-2`} />
            <textarea defaultValue={s.contentEn} onBlur={(e) => update(s.id, { contentEn: e.target.value })} placeholder="Content (English)" rows={2} className={`${inputClass} mt-2`} />
          </div>
        ))}

        <div className="rounded-lg border border-dashed border-ink-100 dark:border-ink-800 p-3 space-y-2">
          <input value={draft.titleZh} onChange={(e) => setDraft({ ...draft, titleZh: e.target.value })} placeholder="新段落標題（中文，選填）" className={inputClass} />
          <input value={draft.titleEn} onChange={(e) => setDraft({ ...draft, titleEn: e.target.value })} placeholder="Title (English, optional)" className={inputClass} />
          <textarea value={draft.contentZh} onChange={(e) => setDraft({ ...draft, contentZh: e.target.value })} placeholder="內容（中文）" rows={2} className={inputClass} />
          <textarea value={draft.contentEn} onChange={(e) => setDraft({ ...draft, contentEn: e.target.value })} placeholder="Content (English)" rows={2} className={inputClass} />
          <button onClick={add} className="flex items-center gap-1.5 rounded-lg bg-transit-500 px-3 py-1.5 text-xs font-medium text-white"><Plus size={14} /> 新增段落</button>
        </div>
      </div>
    </section>
  );
}

type Member = { id: string; nameZh: string; nameEn: string; roleZh: string; roleEn: string; bioZh: string; bioEn: string; photo: string | null; order: number };

function TeamSection() {
  const [items, setItems] = useState<Member[]>([]);
  const [draft, setDraft] = useState({ nameZh: "", nameEn: "", roleZh: "", roleEn: "", photo: null as string | null });

  async function load() {
    const d = await fetch("/api/admin/team-members").then((r) => r.json());
    setItems(d.members);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!draft.nameZh.trim()) return;
    await fetch("/api/admin/team-members", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, order: items.length }) });
    setDraft({ nameZh: "", nameEn: "", roleZh: "", roleEn: "", photo: null });
    load();
  }
  async function update(id: string, data: Partial<Member>) {
    await fetch(`/api/admin/team-members/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    load();
  }
  async function move(item: Member, dir: -1 | 1) {
    const sorted = [...items].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((s) => s.id === item.id);
    const swap = sorted[idx + dir];
    if (!swap) return;
    await Promise.all([update(item.id, { order: swap.order }), update(swap.id, { order: item.order })]);
  }
  async function remove(id: string) {
    if (!confirm("確定刪除這位成員？")) return;
    await fetch(`/api/admin/team-members/${id}`, { method: "DELETE" });
    load();
  }

  const sorted = [...items].sort((a, b) => a.order - b.order);

  return (
    <section>
      <h2 className="font-display text-lg font-bold">團隊介紹</h2>
      <div className="mt-3 max-w-xl space-y-3">
        {sorted.map((m, i) => (
          <div key={m.id} className="rounded-lg border border-ink-100 dark:border-ink-800 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex flex-col">
                <button onClick={() => move(m, -1)} disabled={i === 0} className="p-0.5 text-ink-400 disabled:opacity-20"><ArrowUp size={13} /></button>
                <button onClick={() => move(m, 1)} disabled={i === sorted.length - 1} className="p-0.5 text-ink-400 disabled:opacity-20"><ArrowDown size={13} /></button>
              </div>
              <input defaultValue={m.nameZh} onBlur={(e) => update(m.id, { nameZh: e.target.value })} placeholder="姓名（中文）" className={inputClass} />
              <input defaultValue={m.nameEn} onBlur={(e) => update(m.id, { nameEn: e.target.value })} placeholder="Name (English)" className={inputClass} />
              <button onClick={() => remove(m.id)} className="shrink-0 rounded-lg p-1.5 text-red-400 hover:bg-red-500/10"><Trash2 size={14} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input defaultValue={m.roleZh} onBlur={(e) => update(m.id, { roleZh: e.target.value })} placeholder="職稱（中文）" className={inputClass} />
              <input defaultValue={m.roleEn} onBlur={(e) => update(m.id, { roleEn: e.target.value })} placeholder="Role (English)" className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <textarea defaultValue={m.bioZh} onBlur={(e) => update(m.id, { bioZh: e.target.value })} placeholder="簡介（中文，選填）" rows={2} className={inputClass} />
              <textarea defaultValue={m.bioEn} onBlur={(e) => update(m.id, { bioEn: e.target.value })} placeholder="Bio (English, optional)" rows={2} className={inputClass} />
            </div>
            <ImageUploader value={m.photo} onChange={(url) => update(m.id, { photo: url })} label="照片" />
          </div>
        ))}

        <div className="rounded-lg border border-dashed border-ink-100 dark:border-ink-800 p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input value={draft.nameZh} onChange={(e) => setDraft({ ...draft, nameZh: e.target.value })} placeholder="新成員姓名（中文）" className={inputClass} />
            <input value={draft.nameEn} onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })} placeholder="Name (English)" className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={draft.roleZh} onChange={(e) => setDraft({ ...draft, roleZh: e.target.value })} placeholder="職稱（中文）" className={inputClass} />
            <input value={draft.roleEn} onChange={(e) => setDraft({ ...draft, roleEn: e.target.value })} placeholder="Role (English)" className={inputClass} />
          </div>
          <button onClick={add} className="flex items-center gap-1.5 rounded-lg bg-transit-500 px-3 py-1.5 text-xs font-medium text-white"><Plus size={14} /> 新增成員</button>
        </div>
      </div>
    </section>
  );
}

type PartnerRow = { id: string; nameZh: string; nameEn: string; descriptionZh: string; descriptionEn: string; logo: string | null; websiteUrl: string; order: number };

function PartnersSection() {
  const [items, setItems] = useState<PartnerRow[]>([]);
  const [draft, setDraft] = useState({ nameZh: "", nameEn: "", websiteUrl: "", logo: null as string | null });

  async function load() {
    const d = await fetch("/api/admin/partners").then((r) => r.json());
    setItems(d.partners);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!draft.nameZh.trim()) return;
    await fetch("/api/admin/partners", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, order: items.length }) });
    setDraft({ nameZh: "", nameEn: "", websiteUrl: "", logo: null });
    load();
  }
  async function update(id: string, data: Partial<PartnerRow>) {
    await fetch(`/api/admin/partners/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    load();
  }
  async function remove(id: string) {
    if (!confirm("確定刪除這個合作單位？")) return;
    await fetch(`/api/admin/partners/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <section>
      <h2 className="font-display text-lg font-bold">合作單位</h2>
      <div className="mt-3 max-w-xl space-y-3">
        {items.map((p) => (
          <div key={p.id} className="rounded-lg border border-ink-100 dark:border-ink-800 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <input defaultValue={p.nameZh} onBlur={(e) => update(p.id, { nameZh: e.target.value })} placeholder="名稱（中文）" className={inputClass} />
              <input defaultValue={p.nameEn} onBlur={(e) => update(p.id, { nameEn: e.target.value })} placeholder="Name (English)" className={inputClass} />
              <button onClick={() => remove(p.id)} className="shrink-0 rounded-lg p-1.5 text-red-400 hover:bg-red-500/10"><Trash2 size={14} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <textarea defaultValue={p.descriptionZh} onBlur={(e) => update(p.id, { descriptionZh: e.target.value })} placeholder="說明（中文，選填）" rows={2} className={inputClass} />
              <textarea defaultValue={p.descriptionEn} onBlur={(e) => update(p.id, { descriptionEn: e.target.value })} placeholder="Description (English, optional)" rows={2} className={inputClass} />
            </div>
            <input defaultValue={p.websiteUrl} onBlur={(e) => update(p.id, { websiteUrl: e.target.value })} placeholder="網站連結（選填）" className={inputClass} />
            <ImageUploader value={p.logo} onChange={(url) => update(p.id, { logo: url })} label="Logo" />
          </div>
        ))}
        <div className="rounded-lg border border-dashed border-ink-100 dark:border-ink-800 p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input value={draft.nameZh} onChange={(e) => setDraft({ ...draft, nameZh: e.target.value })} placeholder="新合作單位名稱（中文）" className={inputClass} />
            <input value={draft.nameEn} onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })} placeholder="Name (English)" className={inputClass} />
          </div>
          <input value={draft.websiteUrl} onChange={(e) => setDraft({ ...draft, websiteUrl: e.target.value })} placeholder="網站連結（選填）" className={inputClass} />
          <button onClick={add} className="flex items-center gap-1.5 rounded-lg bg-transit-500 px-3 py-1.5 text-xs font-medium text-white"><Plus size={14} /> 新增合作單位</button>
        </div>
      </div>
    </section>
  );
}

function ContactSection() {
  const [value, setValue] = useState({ contactTitleZh: "", contactTitleEn: "", contactBodyZh: "", contactBodyEn: "", email: "", phone: "", address: "", socialText: "" });
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<StatusMessage>(null);

  useEffect(() => {
    fetch("/api/admin/about")
      .then((r) => r.json())
      .then((d) => {
        const a = d.about;
        let links: { label: string; url: string }[] = [];
        try { links = JSON.parse(a.socialLinksJson || "[]"); } catch { /* 壞掉就當作沒有 */ }
        setValue({
          contactTitleZh: a.contactTitleZh || "", contactTitleEn: a.contactTitleEn || "",
          contactBodyZh: a.contactBodyZh || "", contactBodyEn: a.contactBodyEn || "",
          email: a.email || "", phone: a.phone || "", address: a.address || "",
          socialText: links.map((l) => `${l.label} | ${l.url}`).join("\n"),
        });
        setLoaded(true);
      });
  }, []);

  async function saveContact() {
    const socialLinks = value.socialText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [label, ...rest] = l.split("|");
        const url = rest.join("|").trim();
        return url ? { label: label!.trim() || url, url } : { label: l, url: l };
      });
    const { socialText: _unused, ...fields } = value;
    void _unused;
    // 只送聯絡欄位：不會碰到網站理念（含它的英文）
    const res = await fetch("/api/admin/about", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...fields, socialLinks }) });
    setStatus(res.ok ? { type: "success", text: "儲存成功！" } : { type: "error", text: "儲存失敗。" });
  }

  const set = (k: keyof typeof value) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValue({ ...value, [k]: e.target.value });

  return (
    <section>
      <h2 className="font-display text-lg font-bold">聯絡我們</h2>
      <div className="mt-3"><StatusBanner status={status} /></div>
      {!loaded ? (
        <p className="mt-3 text-sm text-ink-400">載入中…</p>
      ) : (
        <div className="mt-3 max-w-2xl space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={value.contactTitleZh} onChange={set("contactTitleZh")} placeholder="聯絡標題（中文，選填，留空用預設文字）" className={inputClass} />
            <input value={value.contactTitleEn} onChange={set("contactTitleEn")} placeholder="Contact title (English, optional)" className={inputClass} />
            <textarea value={value.contactBodyZh} onChange={set("contactBodyZh")} placeholder="聯絡說明文字（中文，選填）" rows={2} className={inputClass} />
            <textarea value={value.contactBodyEn} onChange={set("contactBodyEn")} placeholder="Contact note (English, optional)" rows={2} className={inputClass} />
          </div>
          <input value={value.email} onChange={set("email")} placeholder="Email" className={inputClass} />
          <input value={value.phone} onChange={set("phone")} placeholder="電話（選填）" className={inputClass} />
          <input value={value.address} onChange={set("address")} placeholder="地址（選填）" className={inputClass} />
          <textarea value={value.socialText} onChange={set("socialText")} placeholder={"社群連結（選填，一行一個：名稱 | 網址）\n例如：Instagram | https://instagram.com/xxx"} rows={3} className={inputClass} />
          <button onClick={saveContact} className="rounded-lg bg-transit-500 px-4 py-2 text-sm font-medium text-white">儲存</button>
        </div>
      )}
    </section>
  );
}
