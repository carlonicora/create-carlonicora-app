import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useDateFnsLocale } from "@/i18n/useDateFnsLocale";
import { configureI18n } from "@carlonicora/nextjs-jsonapi";
import { useLocale, useTranslations } from "next-intl";
import { getLocale } from "next-intl/server";
import { ENV } from "./instrumentation-env";

// Re-export ENV for use by non-middleware code
export { ENV };

// Configure i18n (router, translations, link component, locale)
configureI18n({
  useRouter,
  useTranslations,
  useLocale,
  useDateFnsLocale,
  Link,
  usePathname,
  // The library reads the server locale through this instead of importing next-intl,
  // so instrumentation (which loads the library) never reaches i18n/request.ts.
  getLocale,
});
