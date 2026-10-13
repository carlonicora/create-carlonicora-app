import { ServerSession } from "@carlonicora/nextjs-jsonapi/server";
import { RoleId } from "@{{name}}/shared";
import { getPathname } from "@/i18n/navigation";
import { notFound, redirect } from "next/navigation";

/**
 * Server guard for every administration page. The (admin) layout no longer
 * reads the session, so each page calls this as its first statement.
 *
 * The login path comes from getPathname, never a hand-built `/${locale}/login`:
 * with localePrefix "as-needed" the proxy redirects `/en/login` to `/login`, and
 * a client navigation cannot read the page data across that second redirect.
 */
export async function requireAdministrator(locale: string): Promise<void> {
  if (!(await ServerSession.isLogged())) redirect(getPathname({ href: "/login", locale }));
  if (!(await ServerSession.hasRole(RoleId.Administrator))) notFound();
}
