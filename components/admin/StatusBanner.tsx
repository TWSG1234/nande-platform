"use client";

import { CheckCircle2, XCircle } from "lucide-react";

export type StatusMessage = { type: "success" | "error"; text: string } | null;

export default function StatusBanner({ status }: { status: StatusMessage }) {
  if (!status) return null;
  const isSuccess = status.type === "success";
  return (
    <div
      className={`mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
        isSuccess
          ? "bg-green-500/10 text-green-600 dark:text-green-300"
          : "bg-red-500/10 text-red-600 dark:text-red-300"
      }`}
    >
      {isSuccess ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
      {status.text}
    </div>
  );
}
