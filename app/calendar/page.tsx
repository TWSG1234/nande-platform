import type { Metadata } from "next";
import CalendarContent from "@/components/CalendarContent";
import { getCalendarEvents, getDrillNotice } from "@/lib/serverData";

export const metadata: Metadata = {
  title: "台灣行事曆 Taiwan Calendar",
  description: "2026 年台灣國定假日與固定紀念日，資料來源為行政院人事行政總處官方辦公日曆表。",
};

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const [events, drillNotice] = await Promise.all([getCalendarEvents(), getDrillNotice()]);
  return <CalendarContent events={events} drillNotice={drillNotice} />;
}
