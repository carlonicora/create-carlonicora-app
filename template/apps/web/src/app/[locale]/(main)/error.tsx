"use client";

import { ErrorDetails, Logout } from "@carlonicora/nextjs-jsonapi/components";
import { Button } from "@carlonicora/nextjs-jsonapi/shadcnui";
import { useMessages } from "next-intl";
import { useEffect } from "react";

interface ErrorProps {
  error: Error & { status?: number; digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  const messages = useMessages() as any;

  const [status, message] = error.message.split(`:`) as any[];

  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  if ((error.status ?? +status) === 401) {
    return <Logout />;
  }

  if ((error.status ?? +status) === 404) {
    return <ErrorPage code={404} reset={reset} messages={messages} />;
  }

  if ((error.status ?? +status) === 500 || (error.status ?? +status) === 503) {
    return <ErrorPage code={error.status ?? status} reset={reset} messages={messages} />;
  }

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center">
      <ErrorDetails
        code={error.status ?? +status}
        title={`Something went wrong!`}
        message={message ?? error.message ?? "An unexpected error occurred."}
      />
    </div>
  );
}

function ErrorPage({ code, reset, messages }: { code: number; reset: () => void; messages: any }) {
  const errorMessages = messages?.errors?.[code.toString()];

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center">
      <ErrorDetails
        code={code}
        title={errorMessages?.title || `Error ${code}`}
        message={errorMessages?.message || "An error occurred."}
      />
      <div className="mt-4">
        <Button onClick={reset} variant="default">
          Try again
        </Button>
      </div>
    </div>
  );
}
