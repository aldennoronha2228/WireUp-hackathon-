// selectors/decision.selectors.ts

export const getCandidateParts = (
  logs: any[],
  bom: any[]
): string[] => {
  const searchLogs = logs.filter(
    l =>
      l.type === "tool_call" &&
      l.name === "search_library" &&
      l.status === "done"
  );

  const foundParts = new Set<string>();

  searchLogs.forEach(log => {
    const results = log.output;

    if (!Array.isArray(results)) return;

    results.forEach((part: any) => {
      if (part.mpn) {
        foundParts.add(part.mpn);
      }
    });
  });

  const bomMpns = new Set(
    bom.map(item => item.mpn)
  );

  return Array.from(foundParts)
    .filter(part => !bomMpns.has(part))
    .slice(0, 4);
};

export const getDecisionReasons = (
  logs: any[]
): string[] => {
  const reasoningLogs = logs.filter(
    l =>
      l.type === "thinking" ||
      l.type === "decision"
  );

  const extracted: string[] = [];

  reasoningLogs.forEach(log => {
    const text = log.text || "";

    text
      .split("\n")
      .forEach((line: string) => {
        const clean = line.trim();

        const relevant =
          clean.toLowerCase().includes("selected") ||
          clean.toLowerCase().includes("choose") ||
          clean.toLowerCase().includes("because") ||
          clean.toLowerCase().includes("rejected");

        if (!relevant) return;

        const bulletFree = clean
          .replace(/^[\s\-\*\d\.\✓\▶]+/, "")
          .trim();

        if (
          bulletFree.length > 10 &&
          bulletFree.length < 150
        ) {
          extracted.push(bulletFree);
        }
      });
  });

  return Array.from(
    new Set(extracted)
  ).slice(0, 3);
};