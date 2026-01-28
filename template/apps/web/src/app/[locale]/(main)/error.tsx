"use client";

import { Button, ErrorDetails, Logout } from "@carlonicora/nextjs-jsonapi/components";
import { useMessages, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface ErrorProps {
  error: Error & { status?: number; digest?: string };
  reset: () => void;
}

/**
 * Extract status code and message from an error object.
 * Handles both error.status property and "status:message" format in error.message.
 */
function parseError(error: Error & { status?: number }): { statusCode: number; errorMessage: string } {
  let statusCode: number | undefined = error.status;
  let errorMessage: string = error.message ?? "An unexpected error occurred.";

  // Parse message if status not set and message contains a colon (format: "403:Forbidden")
  if (!statusCode && error.message?.includes(":")) {
    const colonIndex = error.message.indexOf(":");
    const parsedStatus = error.message.substring(0, colonIndex);
    const parsedMessage = error.message.substring(colonIndex + 1);
    const parsed = parseInt(parsedStatus, 10);
    if (!isNaN(parsed)) {
      statusCode = parsed;
      errorMessage = parsedMessage?.trim() || errorMessage;
    }
  }

  return {
    statusCode: statusCode || 500,
    errorMessage,
  };
}

export default function Error({ error, reset }: ErrorProps) {
  const messages = useMessages() as any;
  const t = useTranslations();
  const router = useRouter();

  const { statusCode, errorMessage } = parseError(error);

  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  if (statusCode === 401) {
    return <Logout />;
  }

  if (statusCode === 403) {
    return <ErrorPage code={403} messages={messages} showGoBack router={router} t={t} />;
  }

  if (statusCode === 404) {
    return <ErrorPage code={404} reset={reset} messages={messages} t={t} />;
  }

  if (statusCode === 500 || statusCode === 503) {
    return <ErrorPage code={statusCode} reset={reset} messages={messages} t={t} />;
  }

  // Fallback for other status codes
  const errorMessages = messages?.errors?.[statusCode.toString()];
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center">
      <ErrorDetails
        code={statusCode}
        title={errorMessages?.title || "Something went wrong!"}
        message={errorMessages?.message || errorMessage}
      />
      <div className="mt-4">
        <Button onClick={() => router.back()} variant="outline">
          {t("ui.buttons.go_back")}
        </Button>
      </div>
    </div>
  );
}

interface ErrorPageProps {
  code: number;
  reset?: () => void;
  messages: any;
  showGoBack?: boolean;
  router?: ReturnType<typeof useRouter>;
  t: ReturnType<typeof useTranslations>;
}

function ErrorPage({ code, reset, messages, showGoBack, router, t }: ErrorPageProps) {
  const errorMessages = messages?.errors?.[code.toString()];

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center">
      <ErrorDetails
        code={code}
        title={errorMessages?.title || `Error ${code}`}
        message={errorMessages?.message || "An error occurred."}
      />
      <div className="mt-4">
        {showGoBack && router ? (
          <Button onClick={() => router.back()} variant="outline">
            {t("ui.buttons.go_back")}
          </Button>
        ) : reset ? (
          <Button onClick={reset} variant="default">
            {t("ui.buttons.try_again")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
