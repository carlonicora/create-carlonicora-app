import { NotificationsListContainer, PageContainer } from "@carlonicora/nextjs-jsonapi/components";

export default async function NotificationListPage() {
  return (
    <PageContainer testId="page-inbox-container">
      <NotificationsListContainer />
    </PageContainer>
  );
}
