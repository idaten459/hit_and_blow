import { expect, test } from "@playwright/test";

const HISTORY_KEY = "hit-and-blow:history";

for (const viewport of [
  { name: "desktop", width: 1440, height: 960 },
  { name: "mobile", width: 390, height: 844 }
]) {
  test(`${viewport.name} history rows stay inside the card for every code length and color count`, async ({
    page
  }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/history", { waitUntil: "domcontentloaded" });

    for (let codeLength = 1; codeLength <= 10; codeLength += 1) {
      for (let colorCount = 1; colorCount <= 10; colorCount += 1) {
        await page.evaluate(
          ({ historyKey, summary }) => {
            window.sessionStorage.setItem(historyKey, JSON.stringify([summary]));
          },
          {
            historyKey: HISTORY_KEY,
            summary: buildSummary(codeLength, colorCount)
          }
        );

        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(page.locator(".history-entry").first()).toBeVisible();

        const overflow = await page.evaluate(() => {
          const selectors = [".history-entry", ".history-line", ".history-code", ".history-secret"];

          return selectors.flatMap((selector) =>
            Array.from(document.querySelectorAll<HTMLElement>(selector))
              .map((element, index) => ({
                selector,
                index,
                scrollWidth: element.scrollWidth,
                clientWidth: element.clientWidth
              }))
              .filter((entry) => entry.scrollWidth > entry.clientWidth + 1)
          );
        });

        const pageOverflow = await page.evaluate(() => {
          const root = document.documentElement;
          return root.scrollWidth > root.clientWidth + 1;
        });

        expect(
          overflow,
          `overflow detected for ${viewport.name}, codeLength=${codeLength}, colorCount=${colorCount}`
        ).toEqual([]);
        expect(
          pageOverflow,
          `page overflow detected for ${viewport.name}, codeLength=${codeLength}, colorCount=${colorCount}`
        ).toBeFalsy();
      }
    }
  });
}

function buildSummary(codeLength: number, colorCount: number) {
  const guesses = Array.from({ length: 6 }, (_, guessIndex) => ({
    values: Array.from({ length: codeLength }, (_, valueIndex) => ((guessIndex + valueIndex) % colorCount) + 1),
    feedback: {
      hits: Math.min(codeLength, (guessIndex % codeLength) + 1),
      blows: Math.max(0, Math.min(codeLength - 1, colorCount - 1, guessIndex)),
      isCorrect: guessIndex === 5
    },
    roundNumber: guessIndex + 1,
    turnNumber: guessIndex + 1,
    createdAt: `2026-03-15T12:00:${`${guessIndex}`.padStart(2, "0")}.000Z`,
    playerId: guessIndex % 2 === 0 ? "player-1" : "player-2",
    playerName: guessIndex % 2 === 0 ? "Player 1" : "Player 2"
  }));

  return {
    id: `summary-${codeLength}-${colorCount}`,
    mode: "local",
    settings: {
      mode: "local",
      codeLength,
      colorCount,
      allowDuplicates: true,
      turnLimit: 10,
      assistEnabled: true
    },
    players: ["Player 1", "Player 2"],
    winnerLabel: "Player 1",
    secret: Array.from({ length: codeLength }, (_, index) => ((index + 1) % colorCount) + 1),
    guesses,
    roundsPlayed: guesses.length,
    finishedAt: "2026-03-15T12:15:00.000Z"
  };
}
