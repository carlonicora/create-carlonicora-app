import { Skeleton } from "@carlonicora/nextjs-jsonapi/components";

export function PageSkeleton() {
  return (
    <div className="bg-sidebar flex h-full w-full min-w-0 flex-1 flex-col">
      <div className="flex h-12 items-center gap-3 px-4">
        <Skeleton className="h-6 w-6 rounded-md" />
        <Skeleton className="h-4 w-48" />
        <div className="flex-1" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <div className="bg-background flex flex-1 flex-col gap-6 rounded-t-xl p-6 md:me-2 md:rounded-xl">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  );
}
