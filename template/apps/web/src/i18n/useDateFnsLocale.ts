"use client";

import type { Locale } from "date-fns";
import { enGB, it } from "date-fns/locale";
import { useLocale } from "next-intl";

const dateFnsLocales: Record<string, Locale> = {
  en: enGB,
  it: it,
};

export function useDateFnsLocale(): Locale {
  const locale = useLocale();
  return dateFnsLocales[locale] ?? enGB;
}
