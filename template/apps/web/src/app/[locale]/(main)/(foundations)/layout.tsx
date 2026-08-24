import { redirect } from "@/i18n/routing";
import { ServerSession } from "@carlonicora/nextjs-jsonapi/server";

export default async function FoundationsLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  if (!(await ServerSession.isLogged())) redirect({ href: "/login", locale });
  return props.children;
}
