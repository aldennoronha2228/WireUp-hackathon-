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

/* ── Provider Blacklisting (Circuit Breaker) ────────────────────────────── */
const PROVIDER_BLACKLIST = new Map<string, number>();

function isBlacklisted(providerName: string, modelId: string): boolean {
  const key = `${providerName}:${modelId}`;
  const expiry = PROVIDER_BLACKLIST.get(key);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    PROVIDER_BLACKLIST.delete(key);
    return false;
  }
  return true;
}

function blacklistProvider(providerName: string, modelId: string, durationMs = 120000) {
  const key = `${providerName}:${modelId}`;
  PROVIDER_BLACKLIST.set(key, Date.now() + durationMs);
}

/* ── Model map ───────────────────────────────────────────────────────────── */
export const MODEL_MAP: Record<string, string> = {
  "WU Lite":       "claude-haiku-4-5-20251001",
  "WU Pro":        "claude-sonnet-4-6",
  "WU Max":        "claude-opus-4-8",
  "GPT-4o":        "gpt-4o",
  "GPT-4o Mini":   "gpt-4o-mini",
  "DeepSeek V3":   "deepseek-v3",
  "DeepSeek R1":   "deepseek-reasoner",
  "Kimi K2.6":     "moonshotai/kimi-k2.6",
  "GPT-3.5 Turbo": "gpt-3.5-turbo-0613",
  "Gemini 3 Flash":"gemini-3-flash-preview",
  "Claude Opus":   "claude-opus-4-8",
  "Claude Haiku":  "claude-haiku-4-5-20251001",
  "Gemini Flash":  "gemini-3-flash-preview",
  "Groq Llama 3.3":"llama-3.3-70b-versatile",
  // "Auto" is handled dynamically — see resolveAutoModel()
};

/* ── Auto mode: rotate randomly through cheap/fast models ────────────── */
const AUTO_POOL = [
  "llama-3.3-70b-versatile",    // Groq - fast & working
  "gpt-4o",                     // Bluesminds - gpt-4o working
  "vllm-current",               // Bluesminds reasoning - working
];
function resolveAutoModel(): string {
  return AUTO_POOL[Math.floor(Math.random() * AUTO_POOL.length)];
}
/** Resolve a model key to an actual model ID, handling "Auto" rotation */
export function resolveModelId(modelKey: string): string {
  if (modelKey === "Auto" || modelKey === "auto") return resolveAutoModel();
  return MODEL_MAP[modelKey] ?? DEFAULT_MODEL_ID;
}

export const DEFAULT_MODEL    = "WU Pro";
export const DEFAULT_MODEL_ID = MODEL_MAP[DEFAULT_MODEL];

/* ── Lazy env readers — called at request time, not module load time ──────── */
function tokenLBKey():  string   { return process.env.TOKENLB_API_KEY?.trim()  ?? ""; }
function tokenLBBase(): string   { return (process.env.TOKENLB_BASE_URL ?? "https://api.tokenlab.sh/v1").replace(/\/$/, ""); }
function parseBluesmindsConfig(): { key: string; base: string } {
  let key = process.env.BLUESMINDS_API_KEY?.trim() ?? "";
  let base = process.env.BLUESMINDS_BASE_URL?.trim() ?? "https://api.bluesminds.com/v1";

  const connStr = process.env.BLUESMINDS_CONNECTION_STRING?.trim();
  const sourceStr = connStr || (key.startsWith("{") ? key : "");
  if (sourceStr) {
    try {
      const parsed = JSON.parse(sourceStr);
      if (parsed.key) key = parsed.key.trim();
      if (parsed.url) base = parsed.url.trim();
    } catch (e) {
      console.warn("[llm] Failed to parse Bluesminds connection string JSON:", e);
    }
  }

  base = base.replace(/\/$/, "");
  if (base && base.includes("bluesminds.com") && !base.endsWith("/v1")) {
    base = `${base}/v1`;
  }
  return { key, base };
}

function bluesmindsKey():  string   { return parseBluesmindsConfig().key; }
function bluesmindsBase(): string   { return parseBluesmindsConfig().base; }
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout for non-streaming

  try {
    const res = await fetch(`${base}/chat/completions`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: modelId, messages, max_tokens: maxTokens, temperature: 0.7 }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`${providerName} ${res.status}: ${txt.slice(0, 200)}`);
    }
    const json = await res.json() as any;
    return String(json?.choices?.[0]?.message?.content ?? "").trim();
  } catch (err: any) {
    clearTimeout(timeoutId);
    throw err;
  }
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
  modelId = GROQ_MODEL,
  attempt = 0,
): Promise<string> {
  const keys = groqKeys();
  if (keys.length === 0) throw new Error("No Groq keys configured");
  
  const maxAttempts = keys.length * 2;
  if (attempt >= maxAttempts) throw new Error("All Groq keys exhausted after retry cycles");

  const keyIndex = attempt % keys.length;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method:  "POST",
      headers: { Authorization: `Bearer ${keys[keyIndex]}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: modelId, messages, max_tokens: 600, temperature: 0.7 }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.status === 429 || res.status === 503) {
      console.warn(`[llm] Groq key index ${keyIndex} rate limited (status ${res.status}). Waiting 2s before trying next key...`);
      await new Promise(r => setTimeout(r, 2000));
      return _groq(messages, modelId, attempt + 1);
    }
    if (!res.ok) { const txt = await res.text(); throw new Error(`Groq ${res.status}: ${txt.slice(0, 200)}`); }
    const json = await res.json() as any;
    return String(json?.choices?.[0]?.message?.content ?? "").trim();
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.warn(`[llm] Groq key index ${keyIndex} failed: ${err.message}. Retrying...`);
    await new Promise(r => setTimeout(r, 1000));
    return _groq(messages, modelId, attempt + 1);
  }
}

/* ── Public: resilient non-streaming ────────────────────────────────────── */
export async function callLLM(
  messages:  Array<{ role: string; content: any }>,
  modelKey   = DEFAULT_MODEL,
  maxTokens  = 600,
): Promise<string> {
  const modelId = resolveModelId(modelKey);
  const isClaude = modelId.startsWith("claude-");
  const isGroq = modelId === GROQ_MODEL || modelId.startsWith("llama-");

  const providers = isGroq
    ? [
        { name: "Groq", call: () => _groq(messages, modelId) },
        { name: "Bluesminds", call: () => _bluesminds(messages, modelId, maxTokens) },
        { name: "TokenLB", call: () => _tokenLB(messages, modelId, maxTokens) }
      ]
    : isClaude 
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
      if (provider.name === "Groq" && groqKeys().length === 0) continue;

      if (isBlacklisted(provider.name, modelId)) {
        console.warn(`[llm] Skipping blacklisted provider: ${provider.name} for model ${modelId}`);
        continue;
      }

      return await provider.call();
    } catch (err: any) {
      console.warn(`[llm] ${provider.name}(${modelId}) failed: ${String(err?.message).slice(0, 80)}`);
      const blacklistDuration = provider.name === "Groq" ? 10000 : 120000;
      blacklistProvider(provider.name, modelId, blacklistDuration);
    }
  }

  // 3. Groq if keys exist and wasn't tried first
  if (!isGroq) {
    const gKeys = groqKeys();
    if (gKeys.length > 0) {
      try {
        console.warn("[llm] Falling back to Groq…");
        return await _groq(messages, GROQ_MODEL);
      } catch (e3: any) {
        console.warn(`[llm] Groq failed: ${String(e3?.message).slice(0, 80)}`);
      }
    }
  }

  // 4. Bluesminds with vllm-current fallback
  if (bluesmindsKey() && modelId !== "vllm-current") {
    try {
      console.warn("[llm] Falling back to Bluesminds (vllm-current)…");
      return await _bluesminds(messages, "vllm-current", maxTokens);
    } catch (e4: any) {
      console.warn(`[llm] Bluesminds fallback failed: ${String(e4?.message).slice(0, 80)}`);
    }
  }

  // 5. TokenLB with WU Lite as last resort
  const liteId = MODEL_MAP["WU Lite"];
  if (liteId !== modelId) {
    try {
      console.warn(`[llm] Retrying TokenLB with ${liteId}…`);
      return await _tokenLB(messages, liteId, maxTokens);
    } catch (e5: any) {
      throw new Error(`All LLM providers failed. Last: ${String(e5?.message).slice(0, 120)}`);
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s connection timeout

    try {
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
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

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
    } catch (err: any) {
      clearTimeout(timeoutId);
      throw err;
    }
  };

  const isClaude = modelId.startsWith("claude-");
  const isGroq = modelId === GROQ_MODEL || modelId.startsWith("llama-");

  const gKeys = groqKeys();
  const providers = isGroq
    ? [
        ...gKeys.map((k, idx) => ({ name: `Groq-Key-${idx}`, key: k, base: "https://api.groq.com/openai/v1" })),
        { name: "Bluesminds", key: bluesmindsKey(), base: bluesmindsBase() },
        { name: "TokenLB", key: tokenLBKey(), base: tokenLBBase() }
      ]
    : isClaude 
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

      if (isBlacklisted(provider.name, modelId)) {
        console.warn(`[llm] Skipping blacklisted provider: ${provider.name} for model ${modelId}`);
        continue;
      }

      await tryStream(modelId, provider.key, provider.base, provider.name);
      return;
    } catch (err: any) {
      console.warn(`[llm] Stream ${provider.name}(${modelId}) failed: ${String(err?.message).slice(0, 80)}`);
      const blacklistDuration = provider.name.startsWith("Groq-Key") ? 10000 : 120000;
      blacklistProvider(provider.name, modelId, blacklistDuration);
    }
  }

  // Fallback to Groq if not tried first
  if (!isGroq) {
    const gKeys = groqKeys();
    if (gKeys.length > 0) {
      try {
        console.warn("[llm] Stream → Groq fallback…");
        const content = await _groq(messages, GROQ_MODEL);
        let full = "";
        const words = content.split(" ");
        for (let i = 0; i < words.length; i++) {
          const tok = (i > 0 ? " " : "") + words[i];
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
  }

  // Fallback to Bluesminds with a known working model
  if (bluesmindsKey() && modelId !== "vllm-current") {
    try {
      console.warn("[llm] Stream → Bluesminds fallback (vllm-current)…");
      await tryStream("vllm-current", bluesmindsKey(), bluesmindsBase(), "Bluesminds");
      return;
    } catch (e4: any) {
      console.warn(`[llm] Bluesminds fallback failed: ${String(e4?.message).slice(0, 80)}`);
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
