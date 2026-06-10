import { Request, Response } from "express";
import { IUser } from "../models/user.model";
import { streamTokenLB, MODEL_MAP, DEFAULT_MODEL } from "../lib/llm";

interface AuthRequest extends Request {
  user?: IUser;
}

/* ── Model info for the frontend ────────────────────────────────────────── */
export const CHAT_MODEL_INFO = [
  { key: "WU Lite", id: MODEL_MAP["WU Lite"], sub: "claude-haiku · Fast & cheap"   },
  { key: "WU Pro",  id: MODEL_MAP["WU Pro"],  sub: "claude-sonnet · Balanced"       },
  { key: "WU Max",  id: MODEL_MAP["WU Max"],  sub: "claude-opus · Most capable"     },
];

/* ── System prompt ──────────────────────────────────────────────────────── */
function buildSystem(projectContext?: string): string {
  return [
    "You are WireUp AI, an expert hardware engineering assistant embedded in a professional IDE.",
    "You help engineers with: circuit design, firmware (Arduino/ESP32/STM32), component selection,",
    "PCB layout, embedded C/C++, communication protocols (I2C, SPI, UART, CAN), power design,",
    "debugging, and hardware-software integration.",
    "Be concise and technical. Use bullet points for lists. Use code blocks (```language) for all code.",
    "When giving wiring instructions, be specific about pin numbers and voltages.",
    projectContext
      ? `\nCurrent project context: ${projectContext}`
      : "",
  ].filter(Boolean).join("\n");
}

/* ── SSE sender ─────────────────────────────────────────────────────────── */
function sender(res: Response) {
  return (event: string, data: object) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    if ((res as any).flush) (res as any).flush();
  };
}

/* ── GET /api/chat/models ───────────────────────────────────────────────── */
export const listModels = (_req: Request, res: Response) => {
  res.json({ models: CHAT_MODEL_INFO });
};

/* ── POST /api/chat  ——  SSE streaming chat ─────────────────────────────── */
export const chatStream = async (req: AuthRequest, res: Response) => {
  const {
    messages       = [],
    model: modelKey = DEFAULT_MODEL,
    projectContext  = "",
  } = req.body as {
    messages:        Array<{ role: "user" | "assistant"; content: string }>;
    model?:          string;
    projectContext?: string;
  };

  if (!messages.length || !messages[messages.length - 1]?.content?.trim()) {
    return res.status(400).json({ error: "messages array with at least one message is required" });
  }

  const modelId   = MODEL_MAP[modelKey] ?? MODEL_MAP[DEFAULT_MODEL];
  const systemMsg = { role: "system" as const, content: buildSystem(projectContext) };
  const payload   = [systemMsg, ...messages];

  res.setHeader("Content-Type",      "text/event-stream");
  res.setHeader("Cache-Control",     "no-cache");
  res.setHeader("Connection",        "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = sender(res);

  // Announce which model is being used
  send("model_info", {
    key:   modelKey,
    id:    modelId,
    label: CHAT_MODEL_INFO.find(m => m.key === modelKey)?.sub ?? modelKey,
  });

  await streamTokenLB(
    payload,
    modelId,
    /* onToken */ (token, full) => send("token", { token, full }),
    /* onDone  */ (full, fallback) => {
      send("done", { content: full, ...(fallback ? { fallback } : {}) });
    },
    /* onError */ (err) => {
      send("error", { error: err });
    },
    1024,
  );

  res.end();
};
