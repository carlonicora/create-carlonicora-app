"use client";

import { useLocale } from "next-intl";
import { enGB, it } from "date-fns/locale";
import type { Locale } from "date-fns";

const dateFnsLocales: Record<string, Locale> = {
  en: enGB,
  it: it,
};

export function useDateFnsLocale(): Locale {
  const locale = useLocale();
  return dateFnsLocales[locale] ?? enGB;
}
