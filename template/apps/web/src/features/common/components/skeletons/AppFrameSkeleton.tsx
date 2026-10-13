import { PageSkeleton } from "@/features/common/components/skeletons/PageSkeleton";
import { SidebarSkeleton } from "@/features/common/components/skeletons/SidebarSkeleton";

export function AppFrameSkeleton() {
  return (
    <div className="bg-sidebar flex min-h-svh w-full">
      <SidebarSkeleton />
      <PageSkeleton />
    </div>
  );
}
