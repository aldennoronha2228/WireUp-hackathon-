/**
 * Shared LLM utility
 * Priority:  1. TokenLB (Claude — always tried first, key read lazily at call time)
 *            2. Groq    (only if GROQ keys exist AND TokenLB fails)
 *            3. TokenLB with WU Lite fallback (last resort)
 *
 * All process.env values are read INSIDE functions (lazy) so that dotenv.config()
 * in index.ts has already run before any value is captured.
 */

const GROQ_MODEL = "llama-3.3-70b-versatile";

/* ── Model map ───────────────────────────────────────────────────────────── */
export const MODEL_MAP: Record<string, string> = {
  "WU Lite":     "claude-haiku-4-5-20251001",
  "WU Pro":      "claude-sonnet-4-6",
  "WU Max":      "claude-opus-4-8",
  "GPT-4o":      "gpt-4o",
  "GPT-4o Mini": "gpt-4o-mini",
  "DeepSeek V3": "deepseek-v3",
  "DeepSeek R1": "deepseek-reasoner",
};
export const DEFAULT_MODEL    = "WU Pro";
export const DEFAULT_MODEL_ID = MODEL_MAP[DEFAULT_MODEL];

/* ── Lazy env readers — called at request time, not module load time ──────── */
function tokenLBKey():  string   { return process.env.TOKENLB_API_KEY?.trim()  ?? ""; }
function tokenLBBase(): string   { return (process.env.TOKENLB_BASE_URL ?? "https://api.tokenlab.sh/v1").replace(/\/$/, ""); }
function bluesmindsKey():  string   { return process.env.BLUESMINDS_API_KEY?.trim()  ?? ""; }
function bluesmindsBase(): string   { return (process.env.BLUESMINDS_BASE_URL ?? "https://api.bluesminds.com/v1").replace(/\/$/, ""); }
function groqKeys():    string[] {
  return [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_FALLBACK,
    process.env.GROQ_API_KEY_3,
  ].filter((k): k is string => Boolean(k?.trim()));
}

/* ── Internal: Generic OpenAI-compatible non-streaming ──────────────────── */
async function _openAICompatible(
  messages:  Array<{ role: string; content: any }>,
  modelId:   string,
  maxTokens: number,
  key:       string,
  base:      string,
  providerName: string,
): Promise<string> {
  if (!key) throw new Error(`${providerName} API key is not set`);

  const res = await fetch(`${base}/chat/completions`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: modelId, messages, max_tokens: maxTokens, temperature: 0.7 }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${providerName} ${res.status}: ${txt.slice(0, 200)}`);
  }
  const json = await res.json() as any;
  return String(json?.choices?.[0]?.message?.content ?? "").trim();
}

async function _tokenLB(
  messages:  Array<{ role: string; content: any }>,
  modelId:   string,
  maxTokens: number,
): Promise<string> {
  return _openAICompatible(messages, modelId, maxTokens, tokenLBKey(), tokenLBBase(), "TokenLB");
}

async function _bluesminds(
  messages:  Array<{ role: string; content: any }>,
  modelId:   string,
  maxTokens: number,
): Promise<string> {
  return _openAICompatible(messages, modelId, maxTokens, bluesmindsKey(), bluesmindsBase(), "Bluesminds");
}

/* ── Internal: Groq non-streaming (key rotation) ────────────────────────── */
async function _groq(
  messages: Array<{ role: string; content: any }>,
  attempt = 0,
): Promise<string> {
  const keys = groqKeys();
  if (attempt >= keys.length) throw new Error("All Groq keys exhausted");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method:  "POST",
    headers: { Authorization: `Bearer ${keys[attempt]}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: GROQ_MODEL, messages, max_tokens: 600, temperature: 0.7 }),
  });
  if (res.status === 429 || res.status === 503) return _groq(messages, attempt + 1);
  if (!res.ok) { const txt = await res.text(); throw new Error(`Groq ${res.status}: ${txt.slice(0, 200)}`); }
  const json = await res.json() as any;
  return String(json?.choices?.[0]?.message?.content ?? "").trim();
}

/* ── Public: resilient non-streaming ────────────────────────────────────── */
export async function callLLM(
  messages:  Array<{ role: string; content: any }>,
  modelKey   = DEFAULT_MODEL,
  maxTokens  = 600,
): Promise<string> {
  const modelId = MODEL_MAP[modelKey] ?? DEFAULT_MODEL_ID;
  const isClaude = modelId.startsWith("claude-");

  const providers = isClaude 
    ? [
        { name: "TokenLB", call: () => _tokenLB(messages, modelId, maxTokens) },
        { name: "Bluesminds", call: () => _bluesminds(messages, modelId, maxTokens) }
      ]
    : [
        { name: "Bluesminds", call: () => _bluesminds(messages, modelId, maxTokens) },
        { name: "TokenLB", call: () => _tokenLB(messages, modelId, maxTokens) }
      ];

  for (const provider of providers) {
    try {
      if (provider.name === "TokenLB" && !tokenLBKey()) continue;
      if (provider.name === "Bluesminds" && !bluesmindsKey()) continue;
      return await provider.call();
    } catch (err: any) {
      console.warn(`[llm] ${provider.name}(${modelId}) failed: ${String(err?.message).slice(0, 80)}`);
    }
  }

  // 3. Groq if keys exist
  const gKeys = groqKeys();
  if (gKeys.length > 0) {
    try {
      console.warn("[llm] Falling back to Groq…");
      return await _groq(messages);
    } catch (e3: any) {
      console.warn(`[llm] Groq failed: ${String(e3?.message).slice(0, 80)}`);
    }
  }

    // 4. TokenLB with WU Lite as last resort
    const liteId = MODEL_MAP["WU Lite"];
    if (liteId !== modelId) {
      try {
        console.warn(`[llm] Retrying TokenLB with ${liteId}…`);
        return await _tokenLB(messages, liteId, maxTokens);
      } catch (e4: any) {
        throw new Error(`All LLM providers failed. Last: ${String(e4?.message).slice(0, 120)}`);
      }
    }
    throw new Error(`LLM call failed for model ${modelId}.`);
}

/* ── Public: streaming via TokenLB (with fallbacks) ─────────────────────── */
export async function streamTokenLB(
  messages:  Array<{ role: string; content: any }>,
  modelId:   string,
  onToken:   (token: string, full: string) => void,
  onDone:    (full: string, fallback?: string) => void,
  onError:   (err: string) => void,
  maxTokens  = 1024,
): Promise<void> {
  let usedFallback: string | undefined;

  /* ── inner: stream one model ─────────────────────────────────────────── */
  const tryStream = async (mId: string, key: string, base: string, providerName: string): Promise<void> => {
    const res = await fetch(`${base}/chat/completions`, {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept:         "text/event-stream",
      },
      body: JSON.stringify({
        model:       mId,
        messages,
        max_tokens:  maxTokens,
        temperature: 0.7,
        stream:      true,
      }),
    });

    if (!res.ok || !res.body) {
      const txt = await res.text();
      throw new Error(`${providerName} ${res.status}: ${txt.slice(0, 200)}`);
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let   buf     = "";
    let   full    = "";
    let   done    = false;

    while (!done) {
      const { done: end, value } = await reader.read();
      if (end) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (raw === "[DONE]") { done = true; break; }
        try {
          const chunk  = JSON.parse(raw);
          const token  = String(chunk?.choices?.[0]?.delta?.content ?? "");
          if (token) { full += token; onToken(token, full); }
          const finish = chunk?.choices?.[0]?.finish_reason;
          if (finish && finish !== "null" && finish !== null) done = true;
        } catch { /* skip malformed */ }
      }
    }

    if (full) onDone(full, usedFallback);
  };

  const isClaude = modelId.startsWith("claude-");
  const providers = isClaude 
    ? [
        { name: "TokenLB", key: tokenLBKey(), base: tokenLBBase() },
        { name: "Bluesminds", key: bluesmindsKey(), base: bluesmindsBase() }
      ]
    : [
        { name: "Bluesminds", key: bluesmindsKey(), base: bluesmindsBase() },
        { name: "TokenLB", key: tokenLBKey(), base: tokenLBBase() }
      ];

  for (const provider of providers) {
    try {
      if (!provider.key) continue;
      if (provider.name === "Bluesminds" && provider.key) {
        usedFallback = "bluesminds";
      }
      await tryStream(modelId, provider.key, provider.base, provider.name);
      return;
    } catch (err: any) {
      console.warn(`[llm] Stream ${provider.name}(${modelId}) failed: ${String(err?.message).slice(0, 80)}`);
    }
  }

  // Fallback to Groq
  const gKeys = groqKeys();
  if (gKeys.length > 0) {
    try {
      console.warn("[llm] Stream → Groq fallback…");
      const content = await _groq(messages);
      let full = "";
      for (const word of content.split(" ")) {
        const tok = (full ? " " : "") + word;
        full += tok;
        onToken(tok, full);
        await new Promise(r => setTimeout(r, 12));
      }
      onDone(full, "groq");
      return;
    } catch (e3: any) {
      console.warn(`[llm] Groq stream fallback failed: ${String(e3?.message).slice(0, 80)}`);
    }
  }

  // TokenLB retry with WU Lite
  const liteId = MODEL_MAP["WU Lite"];
  if (liteId !== modelId) {
    try {
      console.warn(`[llm] Stream retry with ${liteId}…`);
      usedFallback = liteId;
      const key = tokenLBKey();
      const base = tokenLBBase();
      if (!key) throw new Error("TOKENLB_API_KEY is not set");
      await tryStream(liteId, key, base, "TokenLB");
      return;
    } catch { /* fall through */ }
  }

  onError(`All providers failed for streaming model ${modelId}.`);
}
