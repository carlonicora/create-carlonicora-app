"use client";
import { ErrorDetails, PageContainer } from "@carlonicora/nextjs-jsonapi/components";
import { UserProvider } from "@carlonicora/nextjs-jsonapi/contexts";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const customError = JSON.parse(error.message);
  return (
    <UserProvider>
      <PageContainer>
        <ErrorDetails code={customError.code ?? 500} message={customError.message ?? error} />
      </PageContainer>
    </UserProvider>
  );
}
