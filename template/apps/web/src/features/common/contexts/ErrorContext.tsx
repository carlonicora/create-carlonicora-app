"use client";

import { ErrorDetails } from "@carlonicora/nextjs-jsonapi/components";
import { Logout } from "@carlonicora/nextjs-jsonapi/components";
import { useMessages } from "next-intl";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";

interface ErrorContextType {
  error: { status: number; message: string } | null;
  showError: (status: number, message: string) => void;
  clearError: () => void;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

export function useErrorHandler() {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error("useErrorHandler must be used within an ErrorProvider");
  }
  return context;
}

export function ErrorProvider({ children }: { children: ReactNode }) {
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  const messages = useMessages() as any;

  const showError = (status: number, message: string) => {
    setError({ status, message });
  };

  const clearError = () => {
    setError(null);
  };

  useEffect(() => {
    const { setGlobalErrorHandler } = require("@/data/abstracts/AbstractService");
    setGlobalErrorHandler(showError);

    return () => {
      setGlobalErrorHandler(null);
    };
  }, []);

  if (error) {
    const errorMessages = messages?.errors?.[error.status.toString()];

    if (error.status === 401) return <Logout />;

    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center">
        <ErrorDetails
          code={error.status}
          title={errorMessages?.title || `Error ${error.status}`}
          message={errorMessages?.message || error.message}
        />
      </div>
    );
  }

  return <ErrorContext.Provider value={{ error, showError, clearError }}>{children}</ErrorContext.Provider>;
}
