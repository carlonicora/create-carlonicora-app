import { SidebarMenuSkeleton, Skeleton } from "@carlonicora/nextjs-jsonapi/components";

const ROWS = 8;

export function SidebarSkeleton() {
  return (
    <div className="bg-sidebar hidden h-svh w-64 shrink-0 flex-col gap-4 p-2 md:flex">
      <div className="flex justify-center pt-4 pb-2">
        <Skeleton className="h-10 w-24 rounded-md" />
      </div>
      <div className="flex flex-col gap-1">
        {Array.from({ length: ROWS }, (_, index) => (
          <SidebarMenuSkeleton key={index} showIcon />
        ))}
      </div>
    </div>
  );
}
