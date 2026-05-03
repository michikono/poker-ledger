import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <Skeleton className="h-8 w-32" />
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="rounded-lg border">
        {["row-1", "row-2", "row-3", "row-4"].map((key) => (
          <div
            key={key}
            className="flex items-center justify-between gap-4 border-b px-4 py-3 last:border-b-0"
          >
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
