"use client";
import { ErrorDetails, PageContainer } from "@carlonicora/nextjs-jsonapi/components";
import { UserProvider } from "@carlonicora/nextjs-jsonapi/contexts";
import { useMessages } from "next-intl";

function parseErrorMessage(message: string): { code: number; message: string | null } {
  try {
    return JSON.parse(message);
  } catch {
    return { code: 500, message: null };
  }
}

export default function ErrorPage({ error }: { error: Error & { digest?: string } }) {
  const messages = useMessages() as any;
  const customError = parseErrorMessage(error.message);
  const code = customError.code ?? 500;
  const errorMessages = messages?.errors?.[code.toString()];

  return (
    <UserProvider>
      <PageContainer>
        <div className="flex min-h-screen w-full flex-col items-center justify-center">
          <ErrorDetails
            code={code}
            title={errorMessages?.title}
            message={customError.message ?? errorMessages?.message ?? "An error occurred."}
          />
        </div>
      </PageContainer>
    </UserProvider>
  );
}
