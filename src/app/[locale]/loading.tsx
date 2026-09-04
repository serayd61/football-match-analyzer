import { Page, SkeletonRows } from '@/components/site/ui';

export default function Loading() {
  return (
    <Page>
      <div className="pt-8 pb-5">
        <div className="skeleton h-4 w-32" />
        <div className="skeleton mt-3 h-9 w-72" />
      </div>
      <SkeletonRows rows={8} />
    </Page>
  );
}
