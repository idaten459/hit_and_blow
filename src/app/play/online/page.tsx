import { Suspense } from "react";
import { OnlinePlayClient } from "@/components/online-play-client";

export default function OnlinePage() {
  return (
    <Suspense fallback={null}>
      <OnlinePlayClient />
    </Suspense>
  );
}
