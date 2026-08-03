"use client";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Link,
  RoundPageContainer,
} from "@carlonicora/nextjs-jsonapi/components";
import { ArrowRightIcon, Building2Icon, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";

type AdminSection = {
  icon: LucideIcon;
  labelKey: string;
  descriptionKey: string;
  href: string;
};

const sections: AdminSection[] = [
  {
    icon: Building2Icon,
    labelKey: "entities.companies",
    descriptionKey: "common.administration_companies_description",
    href: "/administration/companies",
  },
];

export function AdminIndexContainer() {
  const t = useTranslations();

  return (
    <RoundPageContainer>
      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        <div className="text-center">
          <h1 className="text-primary text-3xl font-semibold">{t("common.administration")}</h1>
          <p className="text-muted-foreground mt-2">{t("common.administration_subtitle")}</p>
        </div>

        <div className="grid w-full max-w-4xl grid-cols-1 gap-4 md:grid-cols-4">
          {sections.map((section) => (
            <Link key={section.href} href={section.href} className="group font-normal no-underline">
              <Card className="hover:border-primary/50 h-full cursor-pointer transition-all hover:shadow-md">
                <CardHeader className="gap-3">
                  <div className="bg-muted text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground flex h-10 w-10 items-center justify-center rounded-lg transition-colors">
                    <section.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base">{t(section.labelKey, { count: 2 })}</CardTitle>
                  <CardDescription>{t(section.descriptionKey)}</CardDescription>
                  <div className="text-muted-foreground group-hover:text-primary flex items-center gap-1 text-sm transition-colors">
                    <span>{t("common.open")}</span>
                    <ArrowRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </RoundPageContainer>
  );
}
