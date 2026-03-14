import { Suspense } from "react";
import { LocalGameClient } from "@/components/local-game-client";

export default function LocalPage() {
  return (
    <Suspense fallback={null}>
      <LocalGameClient mode="local" />
    </Suspense>
  );
}
