"use client";

import { useLocale } from "next-intl";
import { enUS, it } from "date-fns/locale";
import type { Locale } from "date-fns";

const dateFnsLocales: Record<string, Locale> = {
  en: enUS,
  it: it,
};

export function useDateFnsLocale(): Locale {
  const locale = useLocale();
  return dateFnsLocales[locale] ?? enUS;
}
