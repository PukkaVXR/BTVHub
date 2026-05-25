import { Card } from "./Card";
import { Skeleton } from "./Skeleton";

export function PageLoading() {
  return (
    <Card className="ui-page-loading" aria-live="polite">
      <Skeleton width="34%" />
      <Skeleton width="62%" />
      <Skeleton width="48%" />
    </Card>
  );
}
