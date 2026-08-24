import { ENV } from "@/config/env";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";

//https://nextjs.org/docs/app/api-reference/functions/generate-metadata

export async function generateSpecificMetadata(params: {
  title?: string;
  description?: string;
  url?: string;
}): Promise<Metadata> {
  const t = await getTranslations();

  const url = (await headers()).get("x-full-url") ?? ENV.APP_URL ?? "https://{{name}}.com";

  const title: string = params.title ? `${params.title} | ${t(`common.title`)}` : t(`common.title`);
  const description = params.description ? params.description : t(`common.description`);

  const response: Metadata = {
    title: title,
    description: description,
    keywords: [],
    publisher: "{{name}}",
    openGraph: {
      type: "website",
      title: title,
      description: description,
      url: url,
      siteName: "{{name}}",
    },
    twitter: {
      card: "summary_large_image",
      title: title,
      description: description,
    },
    metadataBase: new URL(ENV.APP_URL ?? "https://{{name}}.com"),
    alternates: {
      canonical: url,
      languages: {
        en: "/en",
      },
    },
  };

  return response;
}
