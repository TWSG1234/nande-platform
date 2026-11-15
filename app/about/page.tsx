import type { Metadata } from "next";
import AboutContent from "@/components/AboutContent";
import { getAboutMission, getAboutSections, getTeamMembers, getPartners, getAboutContact } from "@/lib/serverData";

export const metadata: Metadata = {
  title: "關於我們 About Us",
  description: "南得遇見你的理念、團隊、合作單位、隱私權政策與使用條款。",
};

export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const [mission, sections, team, partners, contact] = await Promise.all([
    getAboutMission(),
    getAboutSections(),
    getTeamMembers(),
    getPartners(),
    getAboutContact(),
  ]);
  return <AboutContent mission={mission} sections={sections} team={team} partners={partners} contact={contact} />;
}
