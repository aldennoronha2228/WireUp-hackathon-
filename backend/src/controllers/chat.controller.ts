import { Request, Response } from "express";
import { IUser } from "../models/user.model";
import { streamTokenLB, callLLM, MODEL_MAP, DEFAULT_MODEL } from "../lib/llm";
import Project from "../models/project.model";

interface AuthRequest extends Request { user?: IUser; }

export const CHAT_MODEL_INFO = [
  { key: "WU Lite", id: MODEL_MAP["WU Lite"], sub: "claude-haiku · Fast & cheap"  },
  { key: "WU Pro",  id: MODEL_MAP["WU Pro"],  sub: "claude-sonnet · Balanced"      },
  { key: "WU Max",  id: MODEL_MAP["WU Max"],  sub: "claude-opus · Most capable"    },
];

/* ── Detect if message is an edit request ────────────────────────────────── */
const EDIT_PATTERNS = [
  /\b(change|replace|swap|update|modify|edit|add|remove|delete|fix|rewrite)\b.*\b(code|firmware|sensor|component|pin|wiring|diagram|circuit)\b/i,
  /\b(use|switch to|instead of)\b.*\b(dht|esp32|arduino|sensor|component|pin)\b/i,
  /\b(add|include|connect|wire)\b.*\b(led|buzzer|relay|servo|motor|sensor|component)\b/i,
  /\b(change|update|fix|rewrite)\b.*\b(\.ino|firmware|code|sketch|program)\b/i,
];

function isEditRequest(msg: string): boolean {
  const l = msg.toLowerCase();
  
  const editKeywords = [
    "change", "replace", "swap", "update", "modify", "edit", "add", "remove", 
    "delete", "fix", "rewrite", "wire", "connect", "disconnect", "use", "switch", 
    "instead", "implement", "create", "write", "configure", "setup", "put", "attach",
    "insert", "make changes"
  ];
  
  const targetKeywords = [
    "code", "firmware", "sensor", "component", "pin", "wiring", "diagram", 
    "circuit", "led", "display", "buzzer", "button", "relay", "servo", "motor", 
    "esp32", "arduino", "dht", "oled", "bmp", "ultrasonic", "file", "sketch",
    "connection", "component"
  ];

  const hasEdit = editKeywords.some(kw => l.includes(kw));
  const hasTarget = targetKeywords.some(kw => l.includes(kw));
  
  if (hasEdit && hasTarget) return true;
  
  if (l.includes("diagram.json") || l.includes("firmware.ino") || l.includes("components.md") || l.includes("pins.csv") || l.includes("readme.md")) {
    return true;
  }
  
  return EDIT_PATTERNS.some(p => p.test(msg));
}

/* ── Build system prompt ────────────────────────────────────────────────── */
function buildSystem(projectContext: string, files: Array<{ name: string; content: string }>): string {
  const fileList = files.map(f => `${f.name}:\n\`\`\`\n${f.content.slice(0, 800)}\n\`\`\``).join("\n\n");
  return `You are WireUp AI, an expert hardware engineering assistant embedded in a professional IDE.
You help with circuit design, firmware (Arduino/ESP32), component selection, and embedded systems.
Be concise and technical. Use code blocks for all code.

Current project: ${projectContext}

Project files:
${fileList || "No files yet."}

DIAGRAM EDITING DIRECTIVE:
You have direct control over the circuit diagram layout and visual wiring canvas by modifying the "diagram.json" file.
When the user asks you to add, remove, or modify components (e.g. DHT22, servo, LED, ESP32, buzzer) or change the wiring connections, you must modify the "diagram.json" file.
Keep the JSON structure strictly valid. Structure:
{
  "project": "project name",
  "components": [{"id": "mcu", "name": "Arduino Uno", "type": "MCU"}, {"id": "dht22", "name": "DHT22", "type": "Sensor"}],
  "connections": [{"from": "dht22.VCC", "to": "mcu.5V", "signal": "5V"}, {"from": "dht22.DATA", "to": "mcu.D4", "signal": "DATA"}],
  "powerRails": [{"label": "5V", "components": ["mcu.5V", "dht22.VCC"]}]
}

IMPORTANT: When the user asks you to change code, wiring, components or anything in the project files,
you MUST produce the updated file content using this exact format at the END of your response:

Example 1 (modifying firmware.ino):
<file_edit>
<filename>firmware.ino</filename>
<content>
// complete updated file content here
</content>
</file_edit>

Example 2 (modifying diagram.json):
<file_edit>
<filename>diagram.json</filename>
<content>
{
  "project": "Weather Station",
  "components": [
    {"id": "mcu", "name": "Arduino Uno", "type": "MCU"},
    {"id": "dht22", "name": "DHT22", "type": "Sensor"}
  ],
  "connections": [
    {"from": "dht22.VCC", "to": "mcu.5V", "signal": "5V"},
    {"from": "dht22.GND", "to": "mcu.GND", "signal": "GND"},
    {"from": "dht22.DATA", "to": "mcu.D4", "signal": "DATA"}
  ],
  "powerRails": [
    {"label": "5V", "components": ["mcu.5V", "dht22.VCC"]},
    {"label": "GND", "components": ["mcu.GND", "dht22.GND"]}
  ]
}
</content>
</file_edit>

You can include multiple <file_edit> blocks if multiple files need updating (e.g. diagram.json and firmware.ino).
Always produce the COMPLETE file content, not just the changed part.
Only include <file_edit> blocks when actually making edits.`;
}

/* ── Parse file edits from AI response ──────────────────────────────────── */
interface FileEdit { filename: string; content: string; }

function parseFileEdits(text: string): FileEdit[] {
  const edits: FileEdit[] = [];
  const regex = /<file_edit>\s*<filename>(.*?)<\/filename>\s*<content>([\s\S]*?)<\/content>\s*<\/file_edit>/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    const filename = m[1].trim();
    const content  = m[2].trim();
    if (filename && content) edits.push({ filename, content });
  }
  return edits;
}

/* ── Strip file_edit blocks from visible response text ──────────────────── */
function stripFileEdits(text: string): string {
  return text.replace(/<file_edit>[\s\S]*?<\/file_edit>/g, "").trim();
}

function sender(res: Response) {
  return (event: string, data: object) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    if ((res as any).flush) (res as any).flush();
  };
}

export const listModels = (_req: Request, res: Response) => {
  res.json({ models: CHAT_MODEL_INFO });
};

/* ── POST /api/chat ─────────────────────────────────────────────────────── */
export const chatStream = async (req: AuthRequest, res: Response) => {
  const {
    messages       = [],
    model: modelKey = DEFAULT_MODEL,
    projectContext  = "",
    projectId,
  } = req.body as {
    messages:        Array<{ role: "user" | "assistant"; content: string }>;
    model?:          string;
    projectContext?: string;
    projectId?:      string;
  };

  if (!messages.length || !messages[messages.length - 1]?.content?.trim()) {
    return res.status(400).json({ error: "messages array with at least one message is required" });
  }

  const modelId  = MODEL_MAP[modelKey] ?? MODEL_MAP[DEFAULT_MODEL];
  const lastMsg  = messages[messages.length - 1].content;
  const editMode = isEditRequest(lastMsg);

  res.setHeader("Content-Type",      "text/event-stream");
  res.setHeader("Cache-Control",     "no-cache");
  res.setHeader("Connection",        "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = sender(res);
  send("model_info", { key: modelKey, id: modelId,
    label: CHAT_MODEL_INFO.find(m => m.key === modelKey)?.sub ?? modelKey });

  // Load project files for context
  let projectFiles: Array<{ name: string; content: string }> = [];
  if (projectId && req.user?._id) {
    try {
      const proj = await Project.findOne({ _id: projectId, owner: req.user._id });
      if (proj) projectFiles = proj.files.map(f => ({ name: f.name, content: f.content }));
    } catch { /* non-fatal */ }
  }

  const systemContent = buildSystem(projectContext, projectFiles);
  const payload = [
    { role: "system" as const, content: systemContent },
    ...messages,
  ];

  if (editMode) {
    // For edit requests — use non-streaming to capture full response + parse edits
    send("thinking", { message: "Analysing and applying changes…" });

    try {
      const fullResponse = await callLLM(payload, modelKey, 2000);
      const edits        = parseFileEdits(fullResponse);
      const visibleText  = stripFileEdits(fullResponse);

      // Stream visible text word-by-word for effect
      const words = visibleText.split(" ");
      let acc = "";
      for (const word of words) {
        acc += (acc ? " " : "") + word;
        send("token", { token: (acc.length > word.length ? " " : "") + word, full: acc });
        await new Promise(r => setTimeout(r, 10));
      }

      // Apply file edits to DB
      if (edits.length > 0 && projectId && req.user?._id) {
        try {
          const proj = await Project.findOne({ _id: projectId, owner: req.user._id });
          if (proj) {
            for (const edit of edits) {
              const idx = proj.files.findIndex(f => f.name === edit.filename);
              const lang = edit.filename.endsWith(".ino") ? "Arduino"
                : edit.filename.endsWith(".md")  ? "Markdown"
                : edit.filename.endsWith(".csv") ? "CSV"
                : edit.filename.endsWith(".json")? "JSON" : "Plain Text";

              if (idx >= 0) {
                proj.files[idx] = { name: edit.filename, language: lang, content: edit.content };
              } else {
                proj.files.push({ name: edit.filename, language: lang, content: edit.content });
              }
            }
            await proj.save();
          }
        } catch (e) {
          console.error("[chat] Failed to save file edits:", e);
        }
        // Send edits to frontend so it updates the editor live
        send("file_edits", { edits });
      }

      send("done", { content: visibleText, editsApplied: edits.length });

      // Save chat history to DB
      if (projectId && req.user?._id) {
        try {
          await Project.findOneAndUpdate(
            { _id: projectId, owner: req.user._id },
            { chatHistory: [
                ...messages,
                { role: "assistant" as const, content: visibleText }
              ]
            }
          );
        } catch (e) {
          console.error("[chat] Failed to save chat history in editMode:", e);
        }
      }
    } catch (err: any) {
      send("error", { error: err?.message ?? "Edit failed" });
    }

    res.end();
    return;
  }

  // Normal streaming chat (no edits)
  await streamTokenLB(
    payload, modelId,
    (token, full) => send("token", { token, full }),
    async (full, fallback) => {
      send("done", { content: full, ...(fallback ? { fallback } : {}) });
      if (projectId && req.user?._id) {
        try {
          await Project.findOneAndUpdate(
            { _id: projectId, owner: req.user._id },
            { chatHistory: [
                ...messages,
                { role: "assistant" as const, content: full }
              ]
            }
          );
        } catch (e) {
          console.error("[chat] Failed to save chat history in streamTokenLB:", e);
        }
      }
    },
    (err)  => send("error", { error: err }),
    1024,
  );
  res.end();
};
