export default async function MainLayout(props: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { children } = props;

  return (
    <div data-wrapper className="flex h-screen w-full items-center justify-center">
      {children}
    </div>
  );
}
