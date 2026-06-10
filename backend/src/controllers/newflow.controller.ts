// ??$$$ group 2 - Ideation Stage (Phase 1)
// ??$$$ NEW FLOW
import { Request, Response } from "express";
import mongoose from "mongoose";
import { GoogleGenerativeAI } from "@google/generative-ai";
// ??$$$ newer code
import fs from "fs";
import path from "path";
import Groq from "groq-sdk"; // ??$$$
import rotationService from "../services/keyRotation.service";
import NewFlowSession from "../models/newFlowSession.model";
import { runAgent2 } from "../services/newflow.agent";

const safeId = (value: any, fallback: string) => {
  const normalized = String(value || "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  return normalized || fallback;
};

const pickPinPosition = (index: number) => {
  const col = index % 6;
  const row = Math.floor(index / 6);
  return {
    x: -0.75 + col * 0.32,
    y: 0.02,
    z: -0.45 + row * 0.24
  };
};


// ??$$ newer code
const ARDUINO_UNO_PINS = [
  { id: "RESET", x: -0.6, y: 0.1, z: 1.05, type: "system" },
  { id: "3.3V", x: -0.4, y: 0.1, z: 1.05, type: "power" },
  { id: "5V", x: -0.2, y: 0.1, z: 1.05, type: "power" },
  { id: "GND", x: 0.0, y: 0.1, z: 1.05, type: "gnd" },
  { id: "GND.2", x: 0.2, y: 0.1, z: 1.05, type: "gnd" },
  { id: "VIN", x: 0.4, y: 0.1, z: 1.05, type: "power" },
  { id: "A0", x: 0.6, y: 0.1, z: 1.05, type: "analog" },
  { id: "A1", x: 0.75, y: 0.1, z: 1.05, type: "analog" },
  { id: "A2", x: 0.9, y: 0.1, z: 1.05, type: "analog" },
  { id: "A3", x: 1.05, y: 0.1, z: 1.05, type: "analog" },
  { id: "A4", x: 1.2, y: 0.1, z: 1.05, type: "analog" },
  { id: "A5", x: 1.35, y: 0.1, z: 1.05, type: "analog" },
  { id: "RX", x: 1.4, y: 0.1, z: -1.05, type: "serial" },
  { id: "TX", x: 1.25, y: 0.1, z: -1.05, type: "serial" },
  { id: "D2", x: 1.1, y: 0.1, z: -1.05, type: "digital" },
  { id: "D3", x: 0.95, y: 0.1, z: -1.05, type: "digital" },
  { id: "D4", x: 0.8, y: 0.1, z: -1.05, type: "digital" },
  { id: "D5", x: 0.65, y: 0.1, z: -1.05, type: "digital" },
  { id: "D6", x: 0.5, y: 0.1, z: -1.05, type: "digital" },
  { id: "D7", x: 0.35, y: 0.1, z: -1.05, type: "digital" },
  { id: "D8", x: 0.2, y: 0.1, z: -1.05, type: "digital" },
  { id: "D9", x: 0.05, y: 0.1, z: -1.05, type: "digital" },
  { id: "D10", x: -0.1, y: 0.1, z: -1.05, type: "digital" },
  { id: "D11", x: -0.25, y: 0.1, z: -1.05, type: "digital" },
  { id: "D12", x: -0.4, y: 0.1, z: -1.05, type: "digital" },
  { id: "D13", x: -0.55, y: 0.1, z: -1.05, type: "digital" },
  { id: "SDA", x: -0.7, y: 0.1, z: -1.05, type: "i2c" },
  { id: "SCL", x: -0.85, y: 0.1, z: -1.05, type: "i2c" }
];

const getFallbackPinsForComponent = (displayName: string, wokwiPartType?: string) => {
  const name = displayName.toLowerCase();
  if (name.includes("soil") || name.includes("moisture")) {
    return [
      { id: "VCC", x: -0.3, y: 0.02, z: -0.2, type: "power" },
      { id: "GND", x: -0.1, y: 0.02, z: -0.2, type: "power" },
      { id: "SIG", x: 0.1, y: 0.02, z: -0.2, type: "signal" },
      { id: "D0", x: 0.3, y: 0.02, z: -0.2, type: "signal" }
    ];
  }
  if (name.includes("dht") || name.includes("temp") || name.includes("humidity")) {
    return [
      { id: "VCC", x: -0.2, y: 0.02, z: -0.2, type: "power" },
      { id: "GND", x: 0.0, y: 0.02, z: -0.2, type: "power" },
      { id: "SDA", x: 0.2, y: 0.02, z: -0.2, type: "signal" }
    ];
  }
  if (name.includes("mpu") || name.includes("gyro") || name.includes("accelerometer")) {
    return [
      { id: "VCC", x: -0.3, y: 0.02, z: -0.2, type: "power" },
      { id: "GND", x: -0.15, y: 0.02, z: -0.2, type: "power" },
      { id: "SDA", x: 0.0, y: 0.02, z: -0.2, type: "i2c" },
      { id: "SCL", x: 0.15, y: 0.02, z: -0.2, type: "i2c" },
      { id: "INT", x: 0.3, y: 0.02, z: -0.2, type: "signal" }
    ];
  }
  if (name.includes("led")) {
    return [
      { id: "A", x: -0.1, y: 0.02, z: 0.0, type: "signal" },
      { id: "C", x: 0.1, y: 0.02, z: 0.0, type: "signal" }
    ];
  }
  if (name.includes("button") || name.includes("switch")) {
    return [
      { id: "1.l", x: -0.2, y: 0.02, z: -0.2, type: "signal" },
      { id: "2.l", x: 0.2, y: 0.02, z: -0.2, type: "signal" },
      { id: "1.r", x: -0.2, y: 0.02, z: 0.2, type: "signal" },
      { id: "2.r", x: 0.2, y: 0.02, z: 0.2, type: "signal" }
    ];
  }
  return [
    { id: "VCC", x: -0.2, y: 0.02, z: -0.2, type: "power" },
    { id: "GND", x: 0.0, y: 0.02, z: -0.2, type: "power" },
    { id: "SIG", x: 0.2, y: 0.02, z: -0.2, type: "signal" }
  ];
};

const normalizeMcuPin = (pinStr: string): string => {
  const parts = String(pinStr || "").split(".");
  if (parts.length < 2) return pinStr;
  const partKey = parts[0];
  const pinId = parts[1];
  
  if (partKey.toLowerCase() === "mcu" || partKey.toLowerCase() === "arduino") {
    let pin = pinId.toUpperCase().trim();
    if (pin === "GPIO21" || pin === "SDA" || pin === "I2C_SDA") return "mcu.SDA";
    if (pin === "GPIO22" || pin === "SCL" || pin === "I2C_SCL") return "mcu.SCL";
    if (pin === "GPIO13" || pin === "13") return "mcu.D13";
    if (pin === "GPIO12" || pin === "12") return "mcu.D12";
    if (pin === "GPIO11" || pin === "11") return "mcu.D11";
    if (pin === "GPIO10" || pin === "10") return "mcu.D10";
    if (pin === "GPIO9" || pin === "9") return "mcu.D9";
    if (pin === "GPIO8" || pin === "8") return "mcu.D8";
    if (pin === "GPIO7" || pin === "7") return "mcu.D7";
    if (pin === "GPIO6" || pin === "6") return "mcu.D6";
    if (pin === "GPIO5" || pin === "5") return "mcu.D5";
    if (pin === "GPIO4" || pin === "4") return "mcu.D4";
    if (pin === "GPIO3" || pin === "3") return "mcu.D3";
    if (pin === "GPIO2" || pin === "2") return "mcu.D2";
    if (pin === "GPIO1" || pin === "1" || pin === "TX") return "mcu.TX";
    if (pin === "GPIO0" || pin === "0" || pin === "RX") return "mcu.RX";
    if (pin === "3V3" || pin === "3.3V") return "mcu.3.3V";
    if (pin === "5V" || pin === "VCC") return "mcu.5V";
    if (pin === "GND") return "mcu.GND";
    return `mcu.${pin}`;
  }
  return pinStr;
};

const mapSessionToVirtualProject = (session: any) => {
  const bom = Array.isArray(session?.bom) ? session.bom : [];
  const wiring = Array.isArray(session?.wiring) ? session.wiring : [];
  const milestones = Array.isArray(session?.milestones) ? session.milestones : [];
  const context = session?.context || {};

  const circleRadius = 2.4;
  const componentCount = Math.max(bom.length, 1);

  const mappedBom = bom.map((item: any, index: number) => {
    const angle = (index / componentCount) * Math.PI * 2;
    const displayName = String(item?.displayName || item?.mpn || `Component ${index + 1}`);
    const purpose = String(item?.purpose || "");
    const typeHint = `${displayName} ${purpose}`.toLowerCase();

    /* old code
    let componentType = "module";
    if (item?.key === "mcu" || /arduino|esp32|pico|teensy|controller|microcontroller/.test(typeHint)) {
      componentType = "microcontroller";
    } else if (/\bled\b|neopixel|ws2812/.test(typeHint)) {
      componentType = "led";
    } else if (/button|switch|push/.test(typeHint)) {
      componentType = "button";
    }
    */
    // ??$$$ newer code - strictly data-driven component classification with safety net
    let componentType = item?.type || "module";

    // Temporary safety net: map wokwiPartType to correct category if item.type is not set yet
    if (componentType === "module" || !item?.type) {
      const wokwiType = String(item?.wokwiPartType || "").toLowerCase();
      if (wokwiType === "wokwi-servo") {
        componentType = "motor";
      } else if (wokwiType.includes("led") || wokwiType.includes("neopixel") || /\bled\b|neopixel|ws2812/.test(typeHint)) {
        componentType = "led";
      } else if (wokwiType.includes("button") || wokwiType.includes("pushbutton") || /button|switch|push/.test(typeHint)) {
        componentType = "button";
      } else if (wokwiType.includes("lcd") || wokwiType.includes("ssd1306") || wokwiType.includes("ili9341")) {
        componentType = "display";
      } else if (wokwiType.includes("dht") || wokwiType.includes("hc-sr04") || wokwiType.includes("photoresistor") || wokwiType.includes("potentiometer") || wokwiType.includes("mpu6050")) {
        componentType = "sensor";
      } else if (item?.key === "mcu" || wokwiType.includes("arduino") || wokwiType.includes("esp32") || wokwiType.includes("pi-pico") || wokwiType.includes("nodemcu") || /arduino|esp32|pico|teensy|controller|microcontroller/.test(typeHint)) {
        componentType = "microcontroller";
      }
    }

        /* old code
    const pins = Array.isArray(item?.pins) && item.pins.length > 0
      ? item.pins.map((pin: any, pinIndex: number) => {
        const fallback = pickPinPosition(pinIndex);
        return {
          id: String(pin?.id || pin?.name || `P${pinIndex + 1}`),
          x: Number.isFinite(pin?.x_mm) ? Number(pin.x_mm) / 10 : fallback.x,
          y: Number.isFinite(pin?.z_mm) ? Number(pin.z_mm) / 10 : fallback.y,
          z: Number.isFinite(pin?.y_mm) ? Number(pin.y_mm) / 10 : fallback.z,
          type: String(pin?.type || "signal")
        };
      })
      : [
        { id: "P1", x: -0.25, y: 0.02, z: -0.2, type: "signal" },
        { id: "P2", x: 0.25, y: 0.02, z: 0.2, type: "signal" }
      ];
    */
    // ??$$ newer code
    const pins = Array.isArray(item?.pins) && item.pins.length > 0
      ? item.pins.map((pin: any, pinIndex: number) => {
        const fallback = pickPinPosition(pinIndex);
        return {
          id: String(pin?.id || pin?.name || `P${pinIndex + 1}`),
          x: Number.isFinite(pin?.x_mm) ? Number(pin.x_mm) / 10 : fallback.x,
          y: Number.isFinite(pin?.z_mm) ? Number(pin.z_mm) / 10 : fallback.y,
          z: Number.isFinite(pin?.y_mm) ? Number(pin.y_mm) / 10 : fallback.z,
          type: String(pin?.type || "signal")
        };
      })
      : (componentType === "microcontroller"
        ? ARDUINO_UNO_PINS
        : getFallbackPinsForComponent(displayName, item?.wokwiPartType));

    const key = safeId(item?.key || item?.displayName, `component-${index + 1}`);

    return {
      key,
      displayName,
      type: componentType,
      glbUrl: item?.glbUrl || "",
      position: [
        Number((Math.cos(angle) * circleRadius).toFixed(2)),
        0.08,
        Number((Math.sin(angle) * circleRadius).toFixed(2))
      ],
      rotation: [0, Number((angle * -1).toFixed(2)), 0],
      pins
    };
  });

    /* old code
  const mappedWiring = wiring
    .map((wire: any) => ({
      from: String(wire?.from || ""),
      to: String(wire?.to || ""),
      color: String(wire?.color || "#1d4ed8")
    }))
    .filter((wire: any) => wire.from && wire.to);
  */
  // ??$$ newer code
  const mappedWiring = wiring
    .map((wire: any) => {
      const from = normalizeMcuPin(String(wire?.from || ""));
      const to = normalizeMcuPin(String(wire?.to || ""));
      return {
        from,
        to,
        color: String(wire?.color || "#1d4ed8")
      };
    })
    .filter((wire: any) => wire.from && wire.to);

  // ??$$$ old code
  /*
  const byOrder = [...milestones].sort((a: any, b: any) => Number(a?.order || 0) - Number(b?.order || 0));
  const firstCodeMilestone = byOrder.find((m: any) => String(m?.code || "").trim().length > 0);
  const sketch = firstCodeMilestone?.code
    || "void setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  delay(1000);\n}\n";
  */
  /* old code
  // ??$$$ newer code
  const byOrder = [...milestones].sort((a: any, b: any) => Number(b?.order || 0) - Number(a?.order || 0));
  const latestCodeMilestone = byOrder.find((m: any) => String(m?.code || "").trim().length > 0);
  const sketch = latestCodeMilestone?.code
    || "void setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  delay(1000);\n}\n";
  */
  // ??$$$
  const byOrder = [...milestones].sort((a: any, b: any) => Number(b?.order || 0) - Number(a?.order || 0));
  const latestCodeMilestone = byOrder.find((m: any) => String(m?.code || "").trim().length > 0);
  const sketch = session.finalSketch
    || latestCodeMilestone?.code
    || "void setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  delay(1000);\n}\n";

  const additionalTools = Array.from(new Set([
    "Soldering iron",
    "Solder wire",
    "Wire stripper",
    "Wire cutter",
    "Multimeter",
    ...byOrder.flatMap((m: any) => Array.isArray(m?.requiredLibraries) ? m.requiredLibraries : [])
      .filter((lib: any) => lib?.type === "manual")
      .map((lib: any) => `${lib.name}${lib.installCommand ? ` (${lib.installCommand})` : ""}`)
  ]));

  return {
    id: String(session?._id || "virtual-project"),
    name: context?.corePurpose || session?.idea || "Wireup Project",
    description: session?.idea || context?.corePurpose || "AI formulated electronics build",
    author: "Wireup AI",
    createdAt: new Date(session?.createdAt || Date.now()).toISOString().slice(0, 10),
    bom: mappedBom,
    wiring: mappedWiring,
    editableJson: {
      simulationSpeed: 1,
      ledInitialState: false,
      buttonInitialState: false
    },
    sketch,
    context: {
      mcu: context?.mcu || "",
      powerSource: context?.powerSource || "",
      connectivity: context?.connectivity || "",
      constraints: Array.isArray(context?.constraints) ? context.constraints : []
    },
    phases: Array.isArray(context?.subsystems) ? context.subsystems : [],
    milestones: byOrder.map((m: any) => ({
      id: m?.id,
      order: m?.order,
      title: m?.title,
      objective: m?.objective,
      expectedOutput: m?.expectedOutput,
      passCondition: m?.passCondition
    })),
    additionalTools
  };
};

export const AGENT1_SYSTEM_PROMPT = `You are a hardware engineering discovery agent.
Your job is to ask the user clarifying questions about their project idea so that we can formulate it.
Ask ONE clear question at a time. Provide 2 to 4 simple option chips as quick responses, but also allow custom text answers.

Analyze the user's idea and the previous QA history.
If you have enough information to build the project (MCU chosen, subsystems identified, power and connectivity requirements known), set "done" to true.
If NOT done, return the next clarifying "question" and "options".

You must respond ONLY with a JSON object, without markdown, without backticks:
{
  "question": "The next question to ask the user, or empty if done",
  "options": ["Option A", "Option B", "Option C"],
  "done": false,
  "context": {
    "corePurpose": "Summary of the project purpose",
    "mcu": "Suggested microcontroller (e.g. ESP32, Arduino Nano, Raspberry Pi Pico)",
    "subsystems": ["Subsystem1", "Subsystem2"],
    "constraints": ["Constraint1", "Constraint2"],
    "powerSource": "Suggested power source (e.g. USB 5V, Battery)",
    "connectivity": "Suggested connectivity (e.g. WiFi, BLE, None)",
    "openQuestions": ["Remaining unclear items"]
  }
}`;

// ??$$$ newer code - Helper to call LLM for Discovery Agent with robust failover
// QnA / Discovery Session ONLY uses Groq (GROQ_API_KEY & GROQ_API_FALLBACK)
async function executeDiscoveryCall(modelName: string, promptText: string): Promise<any> {
  const keys = [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_FALLBACK,
    process.env.GROQ_API_KEY_3
  ].filter(Boolean) as string[];

  if (keys.length === 0) {
    throw new Error("No Groq API keys found in environment variables.");
  }

  let lastError: any = null;
  const actualModel = "meta-llama/llama-4-scout-17b-16e-instruct";

  for (const apiKey of keys) {
    try {
      console.log(`[Discovery QnA] Calling Groq with key starting: ${apiKey.substring(0, 8)}...`);
      const client = new Groq({ apiKey });
      const completion = await client.chat.completions.create({
        model: actualModel,
        messages: [
          { role: "system", content: AGENT1_SYSTEM_PROMPT },
          { role: "user", content: promptText }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7
      });

      const text = completion.choices[0]?.message?.content?.trim() || "";
      const clean = text.replace(/```json|```/g, "").trim();
      return JSON.parse(clean);
    } catch (err) {
      console.error(`[Discovery QnA Groq Attempt failed with key starting ${apiKey.substring(0, 8)}]:`, err);
      lastError = err;
    }
  }

  throw new Error(`Groq QnA call failed with all provided keys. Last error: ${lastError?.message || lastError}`);
}

// ??$$$ newer code - Helper to call LLM for Discovery Agent directly
async function callDiscovery(modelName: string, promptText: string): Promise<any> {
  return await executeDiscoveryCall(modelName, promptText);
}

// 1. POST /api/new-flow/start
export const startSession = async (req: Request, res: Response) => {
  try {
    const { idea, model = "meta-llama/llama-4-scout-17b-16e-instruct" } = req.body;
    if (!idea) {
      return res.status(400).json({ error: "Original project idea is required." });
    }

    const userId = (req as any).user?._id;

    // Create session
    const session = new NewFlowSession({
      owner: userId,
      selectedModel: model,
      idea,
      qaHistory: [],
      phase1Complete: false,
      phase2Complete: false
    });

    await session.save();

    // Call Discovery Agent for first question
    const promptText = `Original Project Idea: ${idea}\nNo previous Q&A history. Get the first question.`;
    const response = await callDiscovery(model, promptText);

    // Save initial context and first question/options to state
    session.context = response.context || {};
    session.phase1Complete = !!response.done;
    if (session.phase1Complete) {
      session.selectedModel = "ollama/minimax-m3:cloud"; // ??$$ Force Ollama for Formulation
    }

    // ??$$$ newer code
    session.pipelineStages = {
      ideation: {
        status: response.done ? "done" : "running",
        inputs: { idea, model, constraints: response.context?.constraints || [] },
        process: ["Requirement extraction", "Subsystem identification", "MCU selection evaluation"],
        outputs: { context: response.context, nextQuestion: response.question },
        consumers: ["Formulation Agent", "BOM Generator"]
      }
    };

    await session.save();

    return res.json({
      sessionId: session._id,
      question: response.question,
      options: response.options || [],
      done: !!response.done,
      context: session.context
    });
  } catch (err: any) {
    console.error("startSession failed:", err);
    return res.status(500).json({ error: err.message || "Failed to start session." });
  }
};

// 2. POST /api/new-flow/answer
export const answerQuestion = async (req: Request, res: Response) => {
  try {
    const { sessionId, answer, currentQuestion, currentOptions = [] } = req.body;
    if (!sessionId || answer === undefined) {
      return res.status(400).json({ error: "SessionId and answer are required." });
    }

    const session = await NewFlowSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found." });
    }

    // Save previous Q&A to history
    session.qaHistory.push({
      question: currentQuestion || "Clarification",
      options: currentOptions,
      answer,
      timestamp: new Date()
    });

    await session.save();

    // Reconstruct entire prompt context with Q&A history
    let promptText = `Original Project Idea: ${session.idea}\n\nQ&A History:\n`;
    session.qaHistory.forEach((item, index) => {
      promptText += `${index + 1}. Q: ${item.question}\n   A: ${item.answer}\n`;
    });
    promptText += `\nGenerate the next question based on history, or finalize if done.`;

    const response = await callDiscovery(session.selectedModel, promptText);

    // Update session state
    session.context = response.context || session.context;
    session.phase1Complete = !!response.done;
    if (session.phase1Complete) {
      session.selectedModel = "ollama/minimax-m3:cloud"; // ??$$ Force Ollama for Formulation
    }

    // ??$$$ newer code
    session.pipelineStages = {
      ...session.pipelineStages,
      ideation: {
        status: response.done ? "done" : "running",
        inputs: { idea: session.idea, qaHistory: session.qaHistory },
        process: ["Requirement extraction", "Subsystem identification", "MCU selection evaluation"],
        outputs: { context: session.context, nextQuestion: response.question },
        consumers: ["Formulation Agent", "BOM Generator"]
      }
    };
    session.markModified("pipelineStages");

    await session.save();

    return res.json({
      sessionId: session._id,
      question: response.question,
      options: response.options || [],
      done: session.phase1Complete,
      context: session.context
    });
  } catch (err: any) {
    console.error("answerQuestion failed:", err);
    return res.status(500).json({ error: err.message || "Failed to submit answer." });
  }
};

// 3. POST /api/new-flow/proceed
export const proceedSession = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: "SessionId is required." });
    }

    const session = await NewFlowSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found." });
    }

    // ??$$$ old code
    /*
    session.phase1Complete = true;
    await session.save();

    return res.json({
      success: true,
      context: session.context
    });
    */

    // ??$$$ newer code — compile final context from Q&A history on proceed/skip
    let promptText = `Original Project Idea: ${session.idea}\n\nQ&A History:\n`;
    session.qaHistory.forEach((item, index) => {
      promptText += `${index + 1}. Q: ${item.question}\n   A: ${item.answer}\n`;
    });
    promptText += `\nThe user has decided to skip further questions. Please extract and populate the final context object as best as possible from the idea and the Q&A history answered so far. Set "done" to true.`;

    try {
      const response = await callDiscovery(session.selectedModel, promptText);
      if (response && response.context) {
        session.context = response.context;
      }
    } catch (e) {
      console.error("[proceedSession] Failed to run final discovery extraction:", e);
    }

    session.phase1Complete = true;
    session.selectedModel = "ollama/minimax-m3:cloud"; // ??$$ Force Ollama for Formulation
    await session.save();

    return res.json({
      success: true,
      context: session.context
    });
  } catch (err: any) {
    console.error("proceedSession failed:", err);
    return res.status(500).json({ error: err.message || "Failed to proceed session." });
  }
};

// 4. GET /api/new-flow/session/:sessionId
export const getSession = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = await NewFlowSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found." });
    }

    return res.json(session);
  } catch (err: any) {
    console.error("getSession failed:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch session." });
  }
};

// 5. POST /api/new-flow/formulate
export const formulateSession = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: "SessionId is required." });
    }

    const session = await NewFlowSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found." });
    }

    session.selectedModel = "ollama/minimax-m3:cloud"; // ??$$ Force Ollama for Formulation
    await session.save();

    // Run Agent 2 formulation loop in the background
    runAgent2(sessionId, "ollama/minimax-m3:cloud").catch(err => {
      console.error("[Agent2 Background Execution Error]:", err);
    });

    return res.json({
      success: true,
      message: "Agent 2 formulation initiated in the background."
    });
  } catch (err: any) {
    console.error("formulateSession failed:", err);
    return res.status(500).json({ error: err.message || "Failed to formulate session." });
  }
};

// ??$$$ NEW FLOW
// 6. POST /api/new-flow/restart
export const restartSession = async (req: Request, res: Response) => {
  try {
    const { sessionId, context, model } = req.body; // ??$$$ newer code
    if (!sessionId) {
      return res.status(400).json({ error: "SessionId is required." });
    }

    const session = await NewFlowSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found." });
    }

    // ??$$$ newer code
    session.selectedModel = "ollama/minimax-m3:cloud"; // ??$$ Force Ollama for Formulation

    // Save context to database if provided
    if (context) {
      session.context = {
        corePurpose: context.corePurpose || "",
        mcu: context.mcu || "",
        subsystems: Array.isArray(context.subsystems) ? context.subsystems : [],
        constraints: Array.isArray(context.constraints) ? context.constraints : [],
        powerSource: context.powerSource || "",
        connectivity: context.connectivity || "",
        openQuestions: Array.isArray(context.openQuestions) ? context.openQuestions : []
      };
    }

    // Reset formulation progress fields
    session.agentLog = [];
    session.bom = [];
    session.wiring = [];
    session.milestones = [];
    session.phase2Complete = false;
    session.projectId = null;

    await session.save();

    // Trigger fresh Agent 2 loop
    runAgent2(sessionId, "ollama/minimax-m3:cloud").catch(err => {
      console.error("[Agent2 Restart Background Execution Error]:", err);
    });

    return res.json({
      success: true,
      message: "Agent 2 formulation restarted.",
      context: session.context
    });
  } catch (err: any) {
    console.error("restartSession failed:", err);
    return res.status(500).json({ error: err.message || "Failed to restart formulation." });
  }
};

// ??$$$ NEW FLOW
// 7. GET /api/new-flow/project-session/:projectId
export const getSessionByProject = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = (req as any).user?._id;

    let session = await NewFlowSession.findOne({ projectId });
    if (!session) {
      const ProjectModel = mongoose.model("Project");
      const project = await ProjectModel.findById(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found." });
      }

      // Create a new session linked to this project
      session = new NewFlowSession({
        owner: userId,
        selectedModel: "meta-llama/llama-4-scout-17b-16e-instruct",
        idea: project.description,
        qaHistory: [],
        phase1Complete: true,
        phase2Complete: false,
        projectId: project._id
      });

      // Populate context from project details
      if ((project as any).ideation) {
        session.context = {
          corePurpose: (project as any).ideation.objective || project.description || "",
          mcu: (project as any).ideation.compute || "",
          subsystems: (project as any).ideation.phases ? Object.keys((project as any).ideation.phases) : [],
          constraints: (project as any).ideation.constraints ? [(project as any).ideation.constraints] : [],
          powerSource: "",
          connectivity: "",
          openQuestions: (project as any).ideation.open ? [(project as any).ideation.open] : []
        };
      }

      await session.save();
    }

    return res.json(session);
  } catch (err: any) {
    console.error("getSessionByProject failed:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch project session." });
  }
};

// ??$$$ newer code — Export formulation data to local folder on E:
export const exportLocalSession = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: "SessionId is required." });
    }

    const session = await NewFlowSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found." });
    }

    // Define export path on E: drive
    const exportDir = `E:\\wireup_formulation_exports\\session_${sessionId}`;

    // Ensure directory exists
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    // ??$$$ old code
    /*
    fs.writeFileSync(path.join(exportDir, "bom.json"), JSON.stringify(session.bom || [], null, 2), "utf8");
    fs.writeFileSync(path.join(exportDir, "wiring.json"), JSON.stringify(session.wiring || [], null, 2), "utf8");
    fs.writeFileSync(path.join(exportDir, "milestones.json"), JSON.stringify(session.milestones || [], null, 2), "utf8");
    fs.writeFileSync(path.join(exportDir, "diagram.json"), JSON.stringify(session.diagram || {}, null, 2), "utf8");
    fs.writeFileSync(path.join(exportDir, "context.json"), JSON.stringify(session.context || {}, null, 2), "utf8");
    */
    // ??$$$ newer code
    fs.writeFileSync(path.join(exportDir, "bom.json"), JSON.stringify(session.bom || [], null, 2), "utf8");
    fs.writeFileSync(path.join(exportDir, "wiring.json"), JSON.stringify(session.wiring || [], null, 2), "utf8");
    fs.writeFileSync(path.join(exportDir, "milestones.json"), JSON.stringify(session.milestones || [], null, 2), "utf8");
    fs.writeFileSync(path.join(exportDir, "diagram.json"), JSON.stringify(session.diagram || {}, null, 2), "utf8");
    fs.writeFileSync(path.join(exportDir, "context.json"), JSON.stringify(session.context || {}, null, 2), "utf8");

    // ??$$$ old code
    /*
    const byOrder = [...(session.milestones || [])].sort((a: any, b: any) => Number(a?.order || 0) - Number(b?.order || 0));
    const firstCodeMilestone = byOrder.find((m: any) => String(m?.code || "").trim().length > 0);
    const sketchCode = firstCodeMilestone?.code
      || "void setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  delay(1000);\n}\n";
    */
    // ??$$$ old code
    /*
    const byOrder = [...(session.milestones || [])].sort((a: any, b: any) => Number(b?.order || 0) - Number(a?.order || 0));
    const latestCodeMilestone = byOrder.find((m: any) => String(m?.code || "").trim().length > 0);
    const sketchCode = latestCodeMilestone?.code
      || "void setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  delay(1000);\n}\n";
    */
    // ??$$$ newer code
    const sketchCode = session.finalSketch || (
      [...(session.milestones || [])].sort((a: any, b: any) => Number(b?.order || 0) - Number(a?.order || 0))
      .find((m: any) => String(m?.code || "").trim().length > 0)?.code
    ) || "void setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  delay(1000);\n}\n";
    fs.writeFileSync(path.join(exportDir, "sketch.ino"), sketchCode, "utf8");

    // Also write a sketch.json wrapper containing code, as expected by the compilation service
    fs.writeFileSync(path.join(exportDir, "sketch.json"), JSON.stringify({
      code: sketchCode,
      filename: "sketch.ino"
    }, null, 2), "utf8");

    return res.json({
      success: true,
      message: `Formulation data successfully exported to local folder.`,
      exportPath: exportDir
    });
  } catch (err: any) {
    console.error("exportLocalSession failed:", err);
    return res.status(500).json({ error: err.message || "Failed to export session to local folder." });
  }
};

// ??$$$ newer code — Virtual playground payload endpoint from AI formulation session
export const getVirtualProjectData = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required." });
    }

    const session = await NewFlowSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found." });
    }

    const payload = mapSessionToVirtualProject(session);
    return res.json({ success: true, project: payload });
  } catch (err: any) {
    console.error("getVirtualProjectData failed:", err);
    return res.status(500).json({ error: err.message || "Failed to build virtual project payload." });
  }
};

// ??$$$ newer code — POST /new-flow/resume route handler
export const resumeSession = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required." });
    }

    const session = await NewFlowSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found." });
    }

    /* old code
    // Reset session errors and set status back to active
    session.status = "formulating";
    await session.save();
    */

    // Trigger runAgent2 in the background with isResume = true
    const model = session.selectedModel || "gemini-2.5-flash";
    runAgent2(sessionId, model, true).catch(err => {
      console.error("[NewFlowController] Background runAgent2 resume failed:", err);
    });

    const io = (global as any).io;
    if (io) {
      io.to(sessionId).emit("agent2:resumed", { success: true });
    }

    return res.json({
      success: true,
      message: "Formulation resumption triggered successfully."
    });
  } catch (err: any) {
    console.error("resumeSession failed:", err);
    return res.status(500).json({ error: err.message || "Failed to resume formulation session." });
  }
};

// ??$$$ newer code — API Rescue to bypass Ollama and use Groq/Cerebras/Gemini sequentially
export const rescueSession = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: "SessionId is required." });
    }

    const session = await NewFlowSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found." });
    }

    // Trigger runAgent2 in the background with isResume = true AND isRescue = true
    const model = session.selectedModel || "meta-llama/llama-4-scout-17b-16e-instruct";
    runAgent2(sessionId, model, true, true).catch(err => {
      console.error("[NewFlowController] Background runAgent2 rescue failed:", err);
    });

    const io = (global as any).io;
    if (io) {
      io.to(sessionId).emit("agent2:resumed", { success: true });
    }

    return res.json({
      success: true,
      message: "API Rescue triggered successfully."
    });
  } catch (err: any) {
    console.error("rescueSession failed:", err);
    return res.status(500).json({ error: err.message || "Failed to rescue formulation session." });
  }
};
