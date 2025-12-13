"use server";

import { PageContainer } from "@carlonicora/nextjs-jsonapi/components";
import { UserProvider } from "@carlonicora/nextjs-jsonapi/contexts";
import { Skeleton } from "@carlonicora/nextjs-jsonapi/shadcnui";

export default async function Loading() {
  return (
    <UserProvider>
      <PageContainer>
        <div className="flex h-full w-full flex-col items-center justify-center">
          <Skeleton className="h-[125px] w-[250px] rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
        </div>
      </PageContainer>
    </UserProvider>
  );
}
