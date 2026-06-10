// ??$$$
export const stripThinking = (value = ""): string => {
  let cleaned = String(value)
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim();

  // Also strip markdown fences if they exist
  const fenceMatch = cleaned.match(/```(?:cpp|ino|arduino)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  // If no fences, but still has prose before code, try to find the first #include or void
  if (!cleaned.includes("```")) {
    const codeStart = cleaned.search(/(?:#include|void\s+setup|const\s+int|int\s+\w+)/);
    if (codeStart > 0) {
      cleaned = cleaned.substring(codeStart).trim();
    }
  }

  return cleaned;
};

export function stripJsonComments(value = ""): string {
  return String(value || "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .trim();
}

export function normalizeJsonishText(value = ""): string {
  return String(value || "")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/[â€œâ€ ]/g, "\"")
    .replace(/[â€˜â€™]/g, "'")
    .trim();
}

export function stripTrailingCommas(value = ""): string {
  return String(value || "").replace(/,(\s*[}\]])/g, "$1");
}

export function normalizeJsonCandidate(value = ""): string {
  return stripTrailingCommas(
    stripJsonComments(
      normalizeJsonishText(
        stripThinking(value)
      )
    )
  );
}

export function parseJsonIfPossible(value = ""): any {
  const cleaned = normalizeJsonCandidate(value);
  if (!cleaned) {
    return null;
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

export function scoreJsonCandidate(value: any): number {
  if (!value || typeof value !== "object") {
    return -1;
  }

  const expectedKeys = [
    "summary",
    "requirements",
    "unknowns",
    "question",
    "assistantReply",
    "architectureState",
    "architecture",
    "components",
    "reply",
    "screens",
    "chipName",
    "sketchIno",
    "diagramJson",
    "board",
    "sensors",
    "outputs",
    "connectivity",
    "power",
    "projectSummary",
    "confidence"
  ];

  let score = 0;
  for (const key of expectedKeys) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      score += 1;
    }
  }

  return score;
}

export function pickBestJsonCandidate(candidates: any[] = []): any {
  const valid = candidates.filter((value) => value && typeof value === "object");
  if (valid.length === 0) {
    return null;
  }

  return [...valid].sort((left, right) => {
    const scoreDiff = scoreJsonCandidate(right) - scoreJsonCandidate(left);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    return JSON.stringify(right).length - JSON.stringify(left).length;
  })[0];
}

export function extractBalancedJsonObjects(text = ""): any[] {
  const source = String(text || "");
  const results: any[] = [];

  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === "{") {
      if (depth === 0) {
        start = i;
      }
      depth += 1;
      continue;
    }

    if (ch === "}") {
      if (depth === 0) continue;
      depth -= 1;

      if (depth === 0 && start >= 0) {
        const candidate = source.slice(start, i + 1);
        const parsed = parseJsonIfPossible(candidate);
        if (parsed && typeof parsed === "object") {
          results.push(parsed);
        }
        start = -1;
      }
    }
  }

  return results;
}

export const safeParse = (text: string): any => {
  const cleaned = normalizeJsonCandidate(text);

  const direct = parseJsonIfPossible(cleaned);
  if (direct && typeof direct === "object") {
    return direct;
  }

  const fencedCandidates = [...cleaned.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi)]
    .map((match) => parseJsonIfPossible(match?.[1] || ""))
    .filter((value) => value && typeof value === "object");
  const fenced = pickBestJsonCandidate(fencedCandidates);
  if (fenced) {
    return fenced;
  }

  const balanced = pickBestJsonCandidate(extractBalancedJsonObjects(cleaned));
  if (balanced) {
    return balanced;
  }

  throw new Error(`AI response parsing failed. Excerpt: ${cleaned.replace(/\s+/g, " ").trim().slice(0, 400) || "(empty)"}`);
};

export const recoverGeneratedAssetsFromText = (text = ""): any => {
  const cleaned = stripThinking(text);
  if (!cleaned) return null;

  let recoveredSketch = "";
  const codeBlocks = [...cleaned.matchAll(/```(?:cpp|c\+\+|arduino)?\s*([\s\S]*?)```/gi)]
    .map((match) => String(match?.[1] || "").trim())
    .filter(Boolean);

  recoveredSketch = codeBlocks.find((block) =>
    /void\s+setup\s*\(\s*\)/i.test(block) && /void\s+loop\s*\(\s*\)/i.test(block)
  ) || "";

  if (!recoveredSketch) {
    const setupIndex = cleaned.search(/void\s+setup\s*\(/i);
    const loopIndex = cleaned.search(/void\s+loop\s*\(/i);
    if (setupIndex >= 0 && loopIndex >= 0) {
      const start = Math.min(setupIndex, loopIndex);
      recoveredSketch = cleaned.slice(start).trim();
    }
  }

  let recoveredDiagram = null;

  const jsonBlocks = [...cleaned.matchAll(/```json\s*([\s\S]*?)```/gi)]
    .map((match) => parseJsonIfPossible(match?.[1] || ""))
    .filter((value) => value && typeof value === "object");

  recoveredDiagram = jsonBlocks.find((value) => Array.isArray(value?.parts) && Array.isArray(value?.connections)) || null;

  if (!recoveredDiagram) {
    const objects = extractBalancedJsonObjects(cleaned);
    recoveredDiagram = objects.find((value) => Array.isArray(value?.parts) && Array.isArray(value?.connections)) || null;
  }

  if (!recoveredSketch && !recoveredDiagram) {
    return null;
  }

  return {
    sketchIno: recoveredSketch,
    diagramJson: recoveredDiagram,
    notes: ["Recovered assets from non-JSON AI output."]
  };
};

export function parseJsonRecursively(val: any): any {
  if (typeof val === "string") {
    try {
      return parseJsonRecursively(JSON.parse(val));
    } catch {
      return val;
    }
  }
  return val;
}
