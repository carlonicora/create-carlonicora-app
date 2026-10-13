import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Kept apart from routing.ts, following next-intl's own layout: createNavigation
// loads next-intl's request config (i18n/request.ts, which reads `next/root-params`),
// and proxy.ts imports routing.ts. `next/root-params` is only allowed inside the app
// directory, so the proxy must never reach this file.
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
