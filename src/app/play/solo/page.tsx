import { Suspense } from "react";
import { LocalGameClient } from "@/components/local-game-client";

export default function SoloPage() {
  return (
    <Suspense fallback={null}>
      <LocalGameClient mode="solo" />
    </Suspense>
  );
}
