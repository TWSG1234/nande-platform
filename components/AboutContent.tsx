"use client";

import Image from "next/image";
import SectionHeader from "@/components/SectionHeader";
import { Handshake, Mail, Users, Phone, MapPin, ExternalLink } from "lucide-react";
import { Localized } from "@/lib/types";
import { pick } from "@/lib/i18n/pick";
import { useLanguage } from "@/context/LanguageContext";
import { AboutSectionData, TeamMemberData, PartnerData, AboutContact } from "@/lib/serverData";

export default function AboutContent({
  mission,
  sections,
  team,
  partners,
  contact,
}: {
  mission: { title: Localized; body: Localized };
  sections: AboutSectionData[];
  team: TeamMemberData[];
  partners: PartnerData[];
  contact: AboutContact;
}) {
  const { t, lang } = useLanguage();

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-14 space-y-16">
      <div>
        <SectionHeader eyebrow="About Us" title={pick(mission.title, lang)} subtitle={t("about_mission_title")} />
        <p className="mt-6 text-ink-600 dark:text-ink-100 leading-relaxed">{pick(mission.body, lang)}</p>

        {sections.map((s) => (
          <div key={s.id} className="mt-8">
            {s.title && <h4 className="font-display font-semibold text-ink-900 dark:text-white">{pick(s.title, lang)}</h4>}
            <p className="mt-2 text-ink-600 dark:text-ink-100 leading-relaxed">{pick(s.body, lang)}</p>
          </div>
        ))}
      </div>

      {team.length > 0 && (
        <div>
          <h3 className="font-display font-semibold text-lg text-ink-900 dark:text-white flex items-center gap-2">
            <Users size={18} className="text-transit-500" /> {t("about_team_title")}
          </h3>
          <div className="mt-5 grid sm:grid-cols-2 gap-4">
            {team.map((m) => (
              <div key={m.id} className="rounded-xl2 border border-ink-100 dark:border-white/10 bg-card dark:bg-canvas-darkcard p-4 flex items-center gap-3">
                {m.photo ? (
                  <Image src={m.photo} alt={pick(m.name, lang)} width={44} height={44} className="h-11 w-11 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="h-11 w-11 shrink-0 rounded-full bg-transit-500/10 text-transit-600 dark:text-transit-300 flex items-center justify-center font-display font-semibold">
                    {pick(m.name, lang).charAt(0)}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink-900 dark:text-white text-sm">{pick(m.name, lang)}</p>
                  {m.role && <p className="text-xs text-ink-400">{pick(m.role, lang)}</p>}
                  {m.bio && <p className="mt-0.5 text-xs text-ink-400 leading-relaxed">{pick(m.bio, lang)}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {partners.length > 0 && (
        <div>
          <h3 className="font-display font-semibold text-lg text-ink-900 dark:text-white flex items-center gap-2">
            <Handshake size={18} className="text-lantern-500" /> {t("about_partners_title")}
          </h3>
          <div className="mt-5 flex flex-wrap gap-3">
            {partners.map((p) => {
              const name = pick(p.name, lang);
              const content = (
                <span className="flex flex-col rounded-2xl bg-ink-50 dark:bg-white/5 px-4 py-2 text-sm text-ink-600 dark:text-ink-100">
                  <span className="flex items-center gap-2">
                    {p.logo && <Image src={p.logo} alt="" width={18} height={18} className="h-[18px] w-[18px] object-contain" />}
                    {name}
                    {p.websiteUrl && <ExternalLink size={12} className="text-ink-400" />}
                  </span>
                  {p.description && <span className="mt-0.5 text-xs text-ink-400 leading-relaxed">{pick(p.description, lang)}</span>}
                </span>
              );
              return p.websiteUrl ? (
                <a key={p.id} href={p.websiteUrl} target="_blank" rel="noopener noreferrer">
                  {content}
                </a>
              ) : (
                <span key={p.id}>{content}</span>
              );
            })}
          </div>
        </div>
      )}

      <div id="privacy">
        <h3 className="font-display font-semibold text-lg text-ink-900 dark:text-white">{t("about_privacy_title")}</h3>
        <p className="mt-3 text-sm text-ink-400 leading-relaxed">{t("about_privacy_body")}</p>
      </div>

      <div id="terms">
        <h3 className="font-display font-semibold text-lg text-ink-900 dark:text-white">{t("about_terms_title")}</h3>
        <p className="mt-3 text-sm text-ink-400 leading-relaxed">{t("about_terms_body")}</p>
      </div>

      <div id="contact" className="rounded-xl2 border border-ink-100 dark:border-white/10 bg-transit-50 dark:bg-transit-500/10 p-6">
        <h3 className="font-display font-semibold text-lg text-ink-900 dark:text-white flex items-center gap-2">
          <Mail size={18} className="text-transit-500" /> {contact.title ? pick(contact.title, lang) : t("about_contact_title")}
        </h3>
        <p className="mt-2 text-sm text-ink-400">{contact.body ? pick(contact.body, lang) : t("about_contact_note")}</p>
        <div className="mt-3 space-y-1.5">
          <a
            href={`mailto:${contact.email || "hello@taiwancompass.example.edu"}`}
            className="flex items-center gap-1.5 text-sm font-medium text-transit-600 dark:text-transit-300"
          >
            <Mail size={14} /> {contact.email || "hello@taiwancompass.example.edu"}
          </a>
          {contact.phone && (
            <p className="flex items-center gap-1.5 text-sm text-ink-600 dark:text-ink-100">
              <Phone size={14} /> {contact.phone}
            </p>
          )}
          {contact.address && (
            <p className="flex items-center gap-1.5 text-sm text-ink-600 dark:text-ink-100">
              <MapPin size={14} /> {contact.address}
            </p>
          )}
        </div>
        {contact.socialLinks.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-3">
            {contact.socialLinks.map((link) => (
              <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm text-transit-600 dark:text-transit-300 hover:underline">
                {link.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
