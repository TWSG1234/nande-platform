import type { Metadata } from "next";
import IpCharactersContent from "@/components/IpCharactersContent";
import { getIpCharacters } from "@/lib/serverData";

export const metadata: Metadata = {
  title: "IP角色介紹",
  description: "認識南得遇見你的吉祥物角色。",
};

export const dynamic = "force-dynamic";

export default async function IpCharactersPage() {
  const characters = await getIpCharacters();
  return <IpCharactersContent characters={characters} />;
}
