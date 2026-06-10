import { Request, Response } from "express";
import { IUser } from "../models/user.model";
import { callLLM, MODEL_MAP, DEFAULT_MODEL } from "../lib/llm";

interface AuthRequest extends Request {
  user?: IUser;
}

/* ── Pipeline stage definitions ─────────────────────────────────────────── */
const STAGES = [
  {
    key:   "requirements",
    label: "Requirements Analysis",
    prompt: (idea: string) =>
      `You are an expert hardware/software architect. The user wants to build: "${idea}".

List 3-5 clear requirements in bullet points: functional goals, constraints, user needs, and success criteria. Be specific. No preamble.`,
  },
  {
    key:   "architecture",
    label: "Architecture Planning",
    prompt: (idea: string) =>
      `You are an expert systems architect. The user wants to build: "${idea}".

Outline the high-level system architecture in 3-5 bullet points: major subsystems, how they connect, key technologies, and data flow. Be technical and specific.`,
  },
  {
    key:   "components",
    label: "Component Selection",
    prompt: (idea: string) =>
      `You are an expert hardware engineer. The user wants to build: "${idea}".

List the key hardware components with specific part numbers in 4-5 bullet points. For each: name, purpose, and why it was chosen. Include microcontrollers, sensors, power, and communication modules.`,
  },
  {
    key:   "circuit",
    label: "Circuit Generation",
    prompt: (idea: string) =>
      `You are an expert electrical engineer. The user wants to build: "${idea}".

Describe the circuit design in 4-5 bullet points: power supply, signal connections, communication buses (I2C/SPI/UART), pin assignments, and any protection circuits. Reference specific pins and voltages.`,
  },
  {
    key:   "firmware",
    label: "Firmware Generation",
    prompt: (idea: string) =>
      `You are an expert embedded systems engineer. The user wants to build: "${idea}".

Outline the firmware architecture in 3-5 bullet points: programming language, key libraries/frameworks, main control loop, interrupt handlers, and communication protocols. Be specific about implementation.`,
  },
  {
    key:   "validation",
    label: "Simulation Validation",
    prompt: (idea: string) =>
      `You are an expert hardware validation engineer. The user wants to build: "${idea}".

Describe the validation approach in 3-4 bullet points: what to test, how to simulate, expected behavior, and success criteria. Include both hardware and software validation steps.`,
  },
  {
    key:   "documentation",
    label: "Documentation Creation",
    prompt: (idea: string) =>
      `You are a technical documentation expert. The user wants to build: "${idea}".

Outline the documentation package in 3-4 bullet points: README sections, BOM format, assembly instructions, and usage guide. Keep it practical and developer-friendly.`,
  },
] as const;

/* ── SSE sender ─────────────────────────────────────────────────────────── */
function sender(res: Response) {
  return (event: string, data: object) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    if ((res as any).flush) (res as any).flush();
  };
}

/* ── POST /api/generate  ——  pipeline SSE ───────────────────────────────── */
export const generatePipeline = async (req: AuthRequest, res: Response) => {
  const { idea, projectId, model: modelKey = DEFAULT_MODEL } =
    req.body as { idea?: string; projectId?: string; model?: string };

  if (!idea?.trim()) {
    return res.status(400).json({ error: "idea is required" });
  }

  res.setHeader("Content-Type",      "text/event-stream");
  res.setHeader("Cache-Control",     "no-cache");
  res.setHeader("Connection",        "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = sender(res);

  try {
    for (let i = 0; i < STAGES.length; i++) {
      const stage = STAGES[i];

      send("stage_start", {
        index: i,
        key:   stage.key,
        label: stage.label,
        total: STAGES.length,
      });

      const content = await callLLM(
        [{ role: "user", content: stage.prompt(idea.trim()) }],
        modelKey,
        600,
      );

      // Word-by-word streaming
      const words = content.split(" ");
      let accumulated = "";
      for (const word of words) {
        accumulated += (accumulated ? " " : "") + word;
        send("stage_chunk", { index: i, key: stage.key, text: accumulated });
        await new Promise(r => setTimeout(r, 14));
      }

      send("stage_done", {
        index:    i,
        key:      stage.key,
        text:     content,
        progress: Math.round(((i + 1) / STAGES.length) * 100),
      });

      await new Promise(r => setTimeout(r, 280));
    }

    send("pipeline_done", { projectId: projectId ?? null });
  } catch (err: any) {
    send("pipeline_error", { error: err?.message ?? "Generation failed" });
  } finally {
    res.end();
  }
};
