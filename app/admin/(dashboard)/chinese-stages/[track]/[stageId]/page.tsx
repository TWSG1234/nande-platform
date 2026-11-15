"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, ArrowUp, ArrowDown, Trash2, ImagePlus } from "lucide-react";
import ImageUploader from "@/components/admin/ImageUploader";
import CorrectAnimationAdmin from "@/components/admin/CorrectAnimationAdmin";
import StatusBanner, { StatusMessage } from "@/components/admin/StatusBanner";

const PAGE_TYPES = [
  { value: "comic", label: "漫畫" },
  { value: "vocabulary", label: "單字" },
  { value: "fill_blank", label: "填空題" },
  { value: "multiple_choice", label: "選擇題" },
  { value: "matching", label: "配對題" },
  { value: "true_false", label: "判斷題" },
];

type ComicImage = { url: string; width: number; height: number; captionZh?: string; captionEn?: string };
type Word = { id: string; hanzi: string; pinyin: string; english: string; order: number };
type Question = {
  id: string;
  questionType: string;
  promptZh: string;
  promptEn: string;
  answerData: string;
  order: number;
};
type Page = {
  id: string;
  type: string;
  titleZh: string;
  titleEn: string;
  order: number;
  isPublished: boolean;
  comicImages: string | null;
  comicImagesEn: string | null;
  allowFlip: boolean;
  words: Word[];
  questions: Question[];
};
type Stage = { id: string; track: string; levelNumber: number; titleZh: string; pages: Page[] };

export default function AdminChineseStageEditorPage({ params }: { params: { track: string; stageId: string } }) {
  const [stage, setStage] = useState<Stage | null>(null);
  const [status, setStatus] = useState<StatusMessage>(null);
  const [newPageType, setNewPageType] = useState("comic");

  async function load() {
    const res = await fetch(`/api/admin/chinese-stages/${params.stageId}`);
    const data = await res.json();
    if (res.ok) setStage(data.stage);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.stageId]);

  if (!stage) return <p className="text-sm text-ink-400">載入中…</p>;

  const pages = [...stage.pages].sort((a, b) => a.order - b.order);

  async function addPage() {
    const nextOrder = pages.length > 0 ? Math.max(...pages.map((p) => p.order)) + 1 : 0;
    const res = await fetch("/api/admin/chinese-pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageId: stage!.id, type: newPageType, order: nextOrder }),
    });
    if (res.ok) {
      setStatus({ type: "success", text: "已新增頁面！" });
      load();
    } else {
      setStatus({ type: "error", text: "新增失敗，請稍後再試一次。" });
    }
  }

  async function updatePage(id: string, data: Record<string, unknown>) {
    await fetch(`/api/admin/chinese-pages/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    load();
  }

  async function movePage(page: Page, direction: -1 | 1) {
    const idx = pages.findIndex((p) => p.id === page.id);
    const swapWith = pages[idx + direction];
    if (!swapWith) return;
    await Promise.all([
      fetch(`/api/admin/chinese-pages/${page.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: swapWith.order }) }),
      fetch(`/api/admin/chinese-pages/${swapWith.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: page.order }) }),
    ]);
    load();
  }

  async function removePage(id: string) {
    if (!confirm("確定要刪除這一頁嗎？裡面的單字/題目也會一起刪除。")) return;
    await fetch(`/api/admin/chinese-pages/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <Link href={`/admin/chinese-stages/${params.track}`} className="inline-flex items-center gap-1.5 text-xs text-ink-400 hover:text-transit-500">
        <ArrowLeft size={13} /> {params.track === "life" ? "生活" : "校園"}
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold">
        第 {stage.levelNumber} 關{stage.titleZh ? `｜${stage.titleZh}` : ""}
      </h1>
      <p className="mt-1 text-sm text-ink-400">
        自由決定這一關有哪些學習頁、每頁是什麼類型、順序怎麼排——不是固定「漫畫→單字→題目」。
      </p>

      <div className="mt-4">
        <StatusBanner status={status} />
      </div>

      {/* 這一關專屬的答題成功動畫（以關卡 ID 儲存，與其他關卡互不影響） */}
      <CorrectAnimationAdmin key={stage.id} stageId={stage.id} levelLabel={`第 ${stage.levelNumber} 關${stage.titleZh ? `｜${stage.titleZh}` : ""}`} />

      <div className="mt-4 flex items-center gap-2">
        <select
          value={newPageType}
          onChange={(e) => setNewPageType(e.target.value)}
          className="rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-2 text-sm outline-none focus:border-transit-500"
        >
          {PAGE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <button onClick={addPage} className="flex items-center gap-1.5 rounded-lg bg-transit-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-transit-600">
          <Plus size={16} /> 新增頁面
        </button>
      </div>

      <div className="mt-6 space-y-4">
        {pages.length === 0 && (
          <p className="rounded-xl border border-dashed border-ink-100 dark:border-ink-800 p-6 text-center text-sm text-ink-400">
            這一關還沒有任何學習頁，先選類型新增第一頁吧。
          </p>
        )}
        {pages.map((page, i) => (
          <div key={page.id} className="rounded-xl border border-ink-100 dark:border-ink-800 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-col">
                <button onClick={() => movePage(page, -1)} disabled={i === 0} className="p-0.5 text-ink-400 disabled:opacity-20"><ArrowUp size={13} /></button>
                <button onClick={() => movePage(page, 1)} disabled={i === pages.length - 1} className="p-0.5 text-ink-400 disabled:opacity-20"><ArrowDown size={13} /></button>
              </div>
              <span className="rounded-full bg-transit-500/10 px-2.5 py-1 text-xs font-medium text-transit-600 dark:text-transit-300">
                第 {i + 1} 頁｜{PAGE_TYPES.find((t) => t.value === page.type)?.label ?? page.type}
              </span>
              <input
                defaultValue={page.titleZh}
                onBlur={(e) => updatePage(page.id, { titleZh: e.target.value })}
                placeholder="頁面標題（選填，留空顯示類型名稱）"
                className="min-w-0 flex-1 rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-2 py-1 text-sm outline-none focus:border-transit-500"
              />
              <button
                onClick={() => updatePage(page.id, { isPublished: !page.isPublished })}
                className={`rounded-full px-2.5 py-1 text-xs ${page.isPublished ? "bg-green-500/10 text-green-600 dark:text-green-300" : "bg-ink-100 dark:bg-white/10 text-ink-400"}`}
              >
                {page.isPublished ? "顯示中" : "隱藏"}
              </button>
              <button onClick={() => removePage(page.id)} className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/10"><Trash2 size={15} /></button>
            </div>

            <div className="mt-3 border-t border-ink-100 dark:border-ink-800 pt-3">
              {page.type === "comic" && <ComicEditor page={page} onSaved={load} />}
              {page.type === "vocabulary" && <WordsEditor page={page} onSaved={load} />}
              {page.type === "fill_blank" && <FillBlankEditor page={page} onSaved={load} />}
              {page.type === "multiple_choice" && <MultipleChoiceEditor page={page} onSaved={load} />}
              {page.type === "true_false" && <TrueFalseEditor page={page} onSaved={load} />}
              {page.type === "matching" && <QuestionsEditor page={page} onSaved={load} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ComicImageList({
  images,
  onSave,
}: {
  images: ComicImage[];
  onSave: (next: ComicImage[]) => void;
}) {
  const [pending, setPending] = useState<{ url: string; width: number; height: number } | null>(null);
  return (
    <div>
      <div className="space-y-2">
        {images.map((img, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg border border-ink-100 dark:border-ink-800 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt="" className="h-14 w-auto rounded object-contain" style={{ aspectRatio: img.width / img.height }} />
            <span className="flex-1 truncate text-xs text-ink-400">{img.url.split("/").pop()}</span>
            <button onClick={() => onSave(images.filter((_, idx) => idx !== i))} className="rounded p-1 text-red-400 hover:bg-red-500/10">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <ImageUploader
          value={pending?.url ?? null}
          onChange={(url) => setPending((prev) => ({ url, width: prev?.width || 800, height: prev?.height || 1000 }))}
          onDimensions={(w, h) => setPending((prev) => ({ url: prev?.url || "", width: w, height: h }))}
          label=""
        />
        {pending?.url && (
          <button
            onClick={() => {
              onSave([...images, pending]);
              setPending(null);
            }}
            className="flex items-center gap-1 rounded-lg bg-transit-500 px-3 py-1.5 text-xs font-medium text-white"
          >
            <ImagePlus size={13} /> 加入這張圖
          </button>
        )}
      </div>
    </div>
  );
}

function ComicEditor({ page, onSaved }: { page: Page; onSaved: () => void }) {
  const images: ComicImage[] = page.comicImages ? JSON.parse(page.comicImages) : [];
  const imagesEn: ComicImage[] = page.comicImagesEn ? JSON.parse(page.comicImagesEn) : [];

  // 統一的儲存函式：失敗時直接跳提示，不要再發生「上傳完圖片默默消失」卻不知道
  // 為什麼的情況。
  async function putPage(data: Record<string, unknown>) {
    const res = await fetch(`/api/admin/chinese-pages/${page.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "儲存失敗，請重新整理後再試一次。");
    }
    onSaved();
  }
  const saveZh = (next: ComicImage[]) => putPage({ comicImages: next });
  const saveEn = (next: ComicImage[]) => putPage({ comicImagesEn: next });
  const toggleAllowFlip = () => putPage({ allowFlip: !page.allowFlip });

  return (
    <div className="space-y-5">
      <label className="flex items-center gap-2 text-xs font-medium text-ink-400">
        <input type="checkbox" checked={page.allowFlip} onChange={toggleAllowFlip} />
        允許前台翻轉中英文版本（只有中文／英文其中一個有圖時，前台會自動只顯示那個版本，不會出現翻轉提示，這個開關可以再手動關閉）
      </label>

      <div>
        <p className="text-xs font-medium text-ink-400">中文漫畫圖片（可以放好幾張，依序顯示；原始比例，不會被拉伸或裁切）</p>
        <div className="mt-2"><ComicImageList images={images} onSave={saveZh} /></div>
      </div>

      <div>
        <p className="text-xs font-medium text-ink-400">英文漫畫圖片（獨立的一組圖，不是中文圖片的翻譯說明）</p>
        <div className="mt-2"><ComicImageList images={imagesEn} onSave={saveEn} /></div>
      </div>
    </div>
  );
}

function WordsEditor({ page, onSaved }: { page: Page; onSaved: () => void }) {
  const [draft, setDraft] = useState({ hanzi: "", pinyin: "", english: "" });

  async function addWord() {
    if (!draft.hanzi.trim()) return;
    await fetch("/api/admin/chinese-words", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageId: page.id, ...draft, order: page.words.length }),
    });
    setDraft({ hanzi: "", pinyin: "", english: "" });
    onSaved();
  }

  async function updateWord(id: string, data: Partial<Word>) {
    await fetch(`/api/admin/chinese-words/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    onSaved();
  }

  async function removeWord(id: string) {
    await fetch(`/api/admin/chinese-words/${id}`, { method: "DELETE" });
    onSaved();
  }

  return (
    <div>
      <p className="text-xs font-medium text-ink-400">單字（中文／羅馬拼音／英文都是手動輸入，語音會自動用中文欄位透過瀏覽器朗讀，不用另外上傳語音檔）</p>
      <div className="mt-2 space-y-1.5">
        {page.words.map((w) => (
          <div key={w.id} className="grid grid-cols-[1fr_1fr_1.4fr_auto] gap-1.5">
            <input defaultValue={w.hanzi} onBlur={(e) => updateWord(w.id, { hanzi: e.target.value })} placeholder="中文" className="rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-transit-500" />
            <input defaultValue={w.pinyin} onBlur={(e) => updateWord(w.id, { pinyin: e.target.value })} placeholder="拼音" className="rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-transit-500" />
            <input defaultValue={w.english} onBlur={(e) => updateWord(w.id, { english: e.target.value })} placeholder="English" className="rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-transit-500" />
            <button onClick={() => removeWord(w.id)} className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/10"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-[1fr_1fr_1.4fr_auto] gap-1.5">
        <input value={draft.hanzi} onChange={(e) => setDraft({ ...draft, hanzi: e.target.value })} placeholder="中文" className="rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-transit-500" />
        <input value={draft.pinyin} onChange={(e) => setDraft({ ...draft, pinyin: e.target.value })} placeholder="拼音" className="rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-transit-500" />
        <input value={draft.english} onChange={(e) => setDraft({ ...draft, english: e.target.value })} placeholder="English" className="rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-transit-500" />
        <button onClick={addWord} className="flex items-center justify-center rounded-lg bg-transit-500 px-2 text-white"><Plus size={16} /></button>
      </div>
    </div>
  );
}

/** 新增題目：失敗時明確告訴管理員（以前送出失敗也會清空表單、看起來像成功）。 */
async function postQuestion(body: string): Promise<boolean> {
  try {
    const res = await fetch("/api/admin/chinese-questions", { method: "POST", headers: { "Content-Type": "application/json" }, body });
    if (res.ok) return true;
    const data = await res.json().catch(() => ({}));
    alert(res.status === 401 ? "登入已過期，請重新登入後台。" : data.error || "新增題目失敗，請稍後再試一次。");
  } catch {
    alert("無法連到伺服器，題目沒有儲存。請確認網站正在執行後再試一次。");
  }
  return false;
}

function FillBlankEditor({ page, onSaved }: { page: Page; onSaved: () => void }) {
  const [draft, setDraft] = useState({ promptEn: "", promptZh: "", blank: "", acceptableAnswers: "", hintZh: "" });

  const preview = draft.promptZh && draft.blank && draft.promptZh.includes(draft.blank)
    ? draft.promptZh.replace(draft.blank, "____")
    : draft.promptZh;

  async function addQuestion() {
    if (!draft.promptZh.trim() || !draft.blank.trim()) return;
    if (!draft.promptZh.includes(draft.blank.trim())) {
      alert("「要挖空的詞」必須出現在中文完整句子裡，否則前台不會有空格。請檢查是否打錯。");
      return;
    }
    const answerData = JSON.stringify({
      blank: draft.blank.trim(),
      acceptableAnswers: draft.acceptableAnswers.split(",").map((s) => s.trim()).filter(Boolean),
    });
    if (!(await postQuestion(JSON.stringify({
        pageId: page.id,
        questionType: "fill_blank",
        promptEn: draft.promptEn,
        promptZh: draft.promptZh,
        answerData,
        hintZh: draft.hintZh,
        order: page.questions.length,
      })))) return;
    setDraft({ promptEn: "", promptZh: "", blank: "", acceptableAnswers: "", hintZh: "" });
    onSaved();
  }

  async function removeQuestion(id: string) {
    await fetch(`/api/admin/chinese-questions/${id}`, { method: "DELETE" });
    onSaved();
  }

  const inputClass = "w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-transit-500";

  return (
    <div>
      <p className="text-xs font-medium text-ink-400">
        中文請輸入完整正確的句子，再把「要挖空的文字」填進下面的挖空欄位——前台會自動把這段文字換成底線。可接受答案用逗號分隔（選填），例如正確答案本身拼錯常見變體時也能判定正確。
      </p>

      <div className="mt-2 space-y-2">
        {page.questions.map((q) => {
          let parsed: { blank?: string; acceptableAnswers?: string[] } = {};
          try { parsed = JSON.parse(q.answerData); } catch { /* 舊資料格式不符就顯示原始內容 */ }
          return (
            <div key={q.id} className="rounded-lg border border-ink-100 dark:border-ink-800 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1 text-sm">
                  <p className="text-ink-400">EN: {q.promptEn}</p>
                  <p className="text-ink-900 dark:text-white">中: {q.promptZh}</p>
                  <p className="text-xs text-transit-600 dark:text-transit-300">挖空／答案：{parsed.blank || q.answerData}</p>
                </div>
                <button onClick={() => removeQuestion(q.id)} className="shrink-0 rounded-lg p-1.5 text-red-400 hover:bg-red-500/10"><Trash2 size={14} /></button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 space-y-2 rounded-lg border border-dashed border-ink-100 dark:border-ink-800 p-3">
        <input value={draft.promptEn} onChange={(e) => setDraft({ ...draft, promptEn: e.target.value })} placeholder="英文題目，例如 I have a fever." className={inputClass} />
        <input value={draft.promptZh} onChange={(e) => setDraft({ ...draft, promptZh: e.target.value })} placeholder="中文完整句子，例如 我今天感冒了。" className={inputClass} />
        <input value={draft.blank} onChange={(e) => setDraft({ ...draft, blank: e.target.value })} placeholder="要挖空的文字，例如 感冒" className={inputClass} />
        {draft.promptZh && draft.blank && (
          <p className="text-xs text-ink-400">前台預覽：{preview}</p>
        )}
        <input value={draft.acceptableAnswers} onChange={(e) => setDraft({ ...draft, acceptableAnswers: e.target.value })} placeholder="其他可接受答案（選填，用逗號分隔）" className={inputClass} />
        <input value={draft.hintZh} onChange={(e) => setDraft({ ...draft, hintZh: e.target.value })} placeholder="提示文字（選填）" className={inputClass} />
        <button onClick={addQuestion} className="flex items-center gap-1 rounded-lg bg-transit-500 px-3 py-1.5 text-xs font-medium text-white"><Plus size={14} /> 新增題目</button>
      </div>
    </div>
  );
}

function MultipleChoiceEditor({ page, onSaved }: { page: Page; onSaved: () => void }) {
  const [promptZh, setPromptZh] = useState("");
  const [options, setOptions] = useState(["", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);

  async function addQuestion() {
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (!promptZh.trim() || cleanOptions.length < 2) return;
    const correctAnswer = options[correctIndex]?.trim() || cleanOptions[0];
    const answerData = JSON.stringify({ options: cleanOptions, correctAnswer });
    if (!(await postQuestion(JSON.stringify({ pageId: page.id, questionType: "multiple_choice", promptZh, answerData, order: page.questions.length })))) return;
    setPromptZh("");
    setOptions(["", "", ""]);
    setCorrectIndex(0);
    onSaved();
  }

  async function removeQuestion(id: string) {
    await fetch(`/api/admin/chinese-questions/${id}`, { method: "DELETE" });
    onSaved();
  }

  const inputClass = "w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-transit-500";

  return (
    <div>
      <p className="text-xs font-medium text-ink-400">
        選項數量可以自由增減（至少 2 個）。後台的順序只是方便你管理，前台每次進入題目會把選項內容重新隨機排列，標號 A/B/C/D 不會跟著變。
      </p>

      <div className="mt-2 space-y-2">
        {page.questions.map((q) => {
          let parsed: { options?: string[]; correctAnswer?: string } = {};
          try { parsed = JSON.parse(q.answerData); } catch { /* 舊資料格式不符就不解析 */ }
          return (
            <div key={q.id} className="rounded-lg border border-ink-100 dark:border-ink-800 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1 text-sm">
                  <p className="text-ink-900 dark:text-white">{q.promptZh}</p>
                  <p className="text-xs text-ink-400">選項：{(parsed.options || []).join("／")}</p>
                  <p className="text-xs text-transit-600 dark:text-transit-300">正確答案：{parsed.correctAnswer}</p>
                </div>
                <button onClick={() => removeQuestion(q.id)} className="shrink-0 rounded-lg p-1.5 text-red-400 hover:bg-red-500/10"><Trash2 size={14} /></button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 space-y-2 rounded-lg border border-dashed border-ink-100 dark:border-ink-800 p-3">
        <input value={promptZh} onChange={(e) => setPromptZh(e.target.value)} placeholder="題目，例如 哪一個是「保健室」？" className={inputClass} />
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <label className="flex shrink-0 items-center gap-1 text-xs text-ink-400">
              <input type="radio" name="correct" checked={correctIndex === i} onChange={() => setCorrectIndex(i)} />
              正確答案
            </label>
            <input
              value={opt}
              onChange={(e) => setOptions((prev) => prev.map((o, idx) => (idx === i ? e.target.value : o)))}
              placeholder={`選項 ${i + 1}`}
              className={inputClass}
            />
            {options.length > 2 && (
              <button onClick={() => setOptions((prev) => prev.filter((_, idx) => idx !== i))} className="shrink-0 rounded p-1 text-red-400 hover:bg-red-500/10"><Trash2 size={13} /></button>
            )}
          </div>
        ))}
        {options.length < 6 && (
          <button onClick={() => setOptions((prev) => [...prev, ""])} className="flex items-center gap-1 text-xs text-transit-600 dark:text-transit-300"><Plus size={13} /> 新增選項</button>
        )}
        <button onClick={addQuestion} className="flex items-center gap-1 rounded-lg bg-transit-500 px-3 py-1.5 text-xs font-medium text-white"><Plus size={14} /> 新增題目</button>
      </div>
    </div>
  );
}

function TrueFalseEditor({ page, onSaved }: { page: Page; onSaved: () => void }) {
  const [draft, setDraft] = useState({ promptEn: "", promptZh: "", correctAnswer: "o", hintZh: "" });

  async function addQuestion() {
    if (!draft.promptZh.trim()) return;
    if (!(await postQuestion(JSON.stringify({
        pageId: page.id,
        questionType: "true_false",
        promptEn: draft.promptEn,
        promptZh: draft.promptZh,
        answerData: JSON.stringify({ correctAnswer: draft.correctAnswer }),
        hintZh: draft.hintZh,
        order: page.questions.length,
      })))) return;
    setDraft({ promptEn: "", promptZh: "", correctAnswer: "o", hintZh: "" });
    onSaved();
  }

  async function removeQuestion(id: string) {
    await fetch(`/api/admin/chinese-questions/${id}`, { method: "DELETE" });
    onSaved();
  }

  return (
    <div>
      <p className="text-xs font-medium text-ink-400">是非題——正確答案選「○（是）」或「×（非）」。</p>
      <div className="mt-2 space-y-2">
        {page.questions.map((q) => {
          let parsed: { correctAnswer?: string } = {};
          try { parsed = JSON.parse(q.answerData); } catch { /* 忽略 */ }
          return (
            <div key={q.id} className="rounded-lg border border-ink-100 dark:border-ink-800 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1 text-sm">
                  <p className="text-ink-400">EN: {q.promptEn}</p>
                  <p className="text-ink-900 dark:text-white">中: {q.promptZh}</p>
                  <p className="text-xs text-transit-600 dark:text-transit-300">正確答案：{parsed.correctAnswer === "x" ? "×" : "○"}</p>
                </div>
                <button onClick={() => removeQuestion(q.id)} className="shrink-0 rounded-lg p-1.5 text-red-400 hover:bg-red-500/10"><Trash2 size={14} /></button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 space-y-2 rounded-lg border border-dashed border-ink-100 dark:border-ink-800 p-3">
        <input value={draft.promptEn} onChange={(e) => setDraft({ ...draft, promptEn: e.target.value })} placeholder="英文題目" className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-transit-500" />
        <input value={draft.promptZh} onChange={(e) => setDraft({ ...draft, promptZh: e.target.value })} placeholder="中文題目" className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-transit-500" />
        <div className="flex items-center gap-4 text-sm">
          <label className="flex items-center gap-1.5"><input type="radio" checked={draft.correctAnswer === "o"} onChange={() => setDraft({ ...draft, correctAnswer: "o" })} /> ○（是）</label>
          <label className="flex items-center gap-1.5"><input type="radio" checked={draft.correctAnswer === "x"} onChange={() => setDraft({ ...draft, correctAnswer: "x" })} /> ×（非）</label>
        </div>
        <input value={draft.hintZh} onChange={(e) => setDraft({ ...draft, hintZh: e.target.value })} placeholder="提示文字（選填）" className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-transit-500" />
        <button onClick={addQuestion} className="flex items-center gap-1 rounded-lg bg-transit-500 px-3 py-1.5 text-xs font-medium text-white"><Plus size={14} /> 新增題目</button>
      </div>
    </div>
  );
}

function QuestionsEditor({ page, onSaved }: { page: Page; onSaved: () => void }) {
  const [draft, setDraft] = useState({ promptEn: "", promptZh: "", blank: "", distractors: "" });

  const preview = draft.promptZh && draft.blank && draft.promptZh.includes(draft.blank)
    ? draft.promptZh.replace(draft.blank, "____")
    : draft.promptZh;

  async function addQuestion() {
    if (!draft.promptZh.trim() || !draft.blank.trim()) return;
    if (!draft.promptZh.includes(draft.blank.trim())) {
      alert("「要挖空的詞」必須出現在中文完整句子裡，否則前台不會有空格。請檢查是否打錯。");
      return;
    }
    const options = [draft.blank.trim(), ...draft.distractors.split(",").map((s) => s.trim()).filter(Boolean)];
    if (!(await postQuestion(JSON.stringify({
        pageId: page.id,
        questionType: "matching",
        promptEn: draft.promptEn,
        promptZh: draft.promptZh,
        answerData: JSON.stringify({ blank: draft.blank.trim(), options }),
        order: page.questions.length,
      })))) return;
    setDraft({ promptEn: "", promptZh: "", blank: "", distractors: "" });
    onSaved();
  }

  async function removeQuestion(id: string) {
    await fetch(`/api/admin/chinese-questions/${id}`, { method: "DELETE" });
    onSaved();
  }

  return (
    <div>
      <p className="text-xs font-medium text-ink-400">
        配對題——中文輸入完整句子，指定要挖空的詞，再填其他幾個「干擾選項」（答案本身不用重複填）。前台使用者點擊選項就會填入空格，正確才會通過。前台桌面可以用滑鼠拖曳選項到空格，手機直接點選項即可，同一頁所有空格放好後按「提交答案」才會一次判定。
      </p>
      <div className="mt-2 space-y-2">
        {page.questions.map((q) => {
          let parsed: { blank?: string; options?: string[] } = {};
          try { parsed = JSON.parse(q.answerData); } catch { /* 忽略 */ }
          return (
            <div key={q.id} className="rounded-lg border border-ink-100 dark:border-ink-800 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1 text-sm">
                  <p className="text-ink-400">EN: {q.promptEn}</p>
                  <p className="text-ink-900 dark:text-white">中: {q.promptZh}</p>
                  <p className="text-xs text-transit-600 dark:text-transit-300">
                    答案：{parsed.blank}　選項：{(parsed.options || []).join("、")}
                  </p>
                </div>
                <button onClick={() => removeQuestion(q.id)} className="shrink-0 rounded-lg p-1.5 text-red-400 hover:bg-red-500/10"><Trash2 size={14} /></button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 space-y-2 rounded-lg border border-dashed border-ink-100 dark:border-ink-800 p-3">
        <input value={draft.promptEn} onChange={(e) => setDraft({ ...draft, promptEn: e.target.value })} placeholder="英文題目，例如 I go to the clinic." className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-transit-500" />
        <input value={draft.promptZh} onChange={(e) => setDraft({ ...draft, promptZh: e.target.value })} placeholder="中文完整句子，例如 我去診所。" className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-transit-500" />
        <input value={draft.blank} onChange={(e) => setDraft({ ...draft, blank: e.target.value })} placeholder="要挖空的文字（也是正確答案），例如 診所" className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-transit-500" />
        {draft.promptZh && draft.blank && <p className="text-xs text-ink-400">前台預覽：{preview}</p>}
        <input value={draft.distractors} onChange={(e) => setDraft({ ...draft, distractors: e.target.value })} placeholder="其他選項（干擾用，逗號分隔），例如 學校,醫院" className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-transit-500" />
        <button onClick={addQuestion} className="flex items-center gap-1 rounded-lg bg-transit-500 px-3 py-1.5 text-xs font-medium text-white"><Plus size={14} /> 新增題目</button>
      </div>
    </div>
  );
}
