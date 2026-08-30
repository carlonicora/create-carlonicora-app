import { CurrentUserProvider } from "@carlonicora/nextjs-jsonapi/contexts";

export default async function MainLayout(props: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { children } = props;

  return (
    <CurrentUserProvider>
      <div data-wrapper className="flex h-svh w-full items-center justify-center">
        {children}
      </div>
    </CurrentUserProvider>
  );
}
