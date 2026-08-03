import { ServerJsonApiGet } from "@carlonicora/nextjs-jsonapi/server";
import { Modules } from "@carlonicora/nextjs-jsonapi/core";
import type { HowToInterface } from "@carlonicora/nextjs-jsonapi/core";
import { getLocale } from "next-intl/server";

// `cache: "help"` is not a preset profile → serverRequest sets next.tags=["help"], revalidate=60.
const PUBLIC_HOWTO_KEY = { ...Modules.HowTo, cache: "help" };

export async function fetchPublicHowTos(params: { howToType?: string } = {}): Promise<HowToInterface[]> {
  const language = (await getLocale()) ?? "en";
  const endpoint = params.howToType ? `public/howtos?type=${params.howToType}` : `public/howtos`;
  const res = await ServerJsonApiGet({ classKey: PUBLIC_HOWTO_KEY, endpoint, language });
  if (!res.ok || !res.data) return [];
  return (Array.isArray(res.data) ? res.data : [res.data]) as HowToInterface[];
}

export async function fetchPublicHowTo(params: { howToType: string; slug: string }): Promise<HowToInterface | null> {
  const language = (await getLocale()) ?? "en";
  const res = await ServerJsonApiGet({
    classKey: PUBLIC_HOWTO_KEY,
    endpoint: `public/howtos/${params.howToType}/${params.slug}`,
    language,
  });
  if (!res.ok || !res.data) return null;
  return (Array.isArray(res.data) ? res.data[0] : res.data) as HowToInterface;
}

export async function fetchRelatedHowTos(params: { howToType: string; slug: string }): Promise<HowToInterface[]> {
  const language = (await getLocale()) ?? "en";
  const res = await ServerJsonApiGet({
    classKey: PUBLIC_HOWTO_KEY,
    endpoint: `public/howtos/${params.howToType}/${params.slug}/related`,
    language,
  });
  if (!res.ok || !res.data) return [];
  return (Array.isArray(res.data) ? res.data : [res.data]) as HowToInterface[];
}
