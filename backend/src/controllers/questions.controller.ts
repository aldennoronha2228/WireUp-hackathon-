import { Request, Response } from "express";
import { IUser } from "../models/user.model";
import { callLLM, DEFAULT_MODEL } from "../lib/llm";

interface AuthRequest extends Request { user?: IUser; }

export interface Question {
  id:      string;
  text:    string;
  options: string[];  // 4-5 options, last one always "Other..."
  hint?:   string;    // shown below question as helper text
}

/* ── POST /api/questions  ——  generate clarifying questions ─────────────── */
export const generateQuestions = async (req: AuthRequest, res: Response) => {
  const { idea, model = DEFAULT_MODEL } = req.body as { idea?: string; model?: string };

  if (!idea?.trim()) {
    return res.status(400).json({ error: "idea is required" });
  }

  try {
    const raw = await callLLM(
      [{
        role: "user",
        content: `You are a hardware engineering assistant helping design a project.
The user wants to build: "${idea.trim()}"

Generate exactly 6 clarifying questions to better understand their requirements.
The FIRST question MUST be specifically about this project — ask something directly relevant to "${idea.trim()}" (e.g. if it's a temperature sensor project, ask about the measurement range or display; if it's a robot, ask about movement type; if it's IoT, ask about connectivity needs).

The remaining questions must cover:
2. What microcontroller/platform they prefer (Arduino, ESP32, Raspberry Pi, etc.)
3. What hardware/parts they already have
4. Power source (USB, battery, solar, etc.)
5. Display/output method
6. Skill level

For each question provide 4-5 answer options relevant to this specific project. Always include "Not sure — suggest one" for technical choices.

Return ONLY a valid JSON array, no markdown:
[
  {
    "id": "project_goal",
    "text": "Specific question directly about THIS project",
    "hint": "relevant helper text",
    "options": ["option1", "option2", "option3", "option4", "Not sure — suggest one"]
  },
  ...
]`,
      }],
      model,
      900,
    );

    // Parse and validate
    let questions: Question[] = [];
    try {
      // Strip possible markdown code fences
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      questions = JSON.parse(cleaned);
      if (!Array.isArray(questions)) throw new Error("not an array");
    } catch {
      // Fallback: return sensible default questions
      questions = defaultQuestions(idea.trim());
    }

    // Ensure max 8 questions
    questions = questions.slice(0, 8);

    res.json({ questions });
  } catch (err: any) {
    // Always return defaults so the UI doesn't break
    res.json({ questions: defaultQuestions(idea?.trim() ?? "") });
  }
};

/* ── Default questions if LLM fails — first question is project-specific ── */
function defaultQuestions(idea: string): Question[] {
  // Derive a project-specific first question from the idea
  const lower = idea.toLowerCase();
  let firstQ: Question;

  if (lower.includes("temperature") || lower.includes("sensor") || lower.includes("dht")) {
    firstQ = {
      id: "project_goal",
      text: "What should happen when the temperature exceeds a threshold?",
      hint: "This shapes the core logic of your build",
      options: ["Sound a buzzer alarm", "Send a notification (WiFi)", "Turn on a fan/relay", "Just display the reading", "Not sure — suggest one"],
    };
  } else if (lower.includes("robot") || lower.includes("motor") || lower.includes("servo")) {
    firstQ = {
      id: "project_goal",
      text: "How should your robot move?",
      hint: "Determines motors and control logic",
      options: ["Wheels (DC motors)", "Legs (servo motors)", "Arm/gripper (servo)", "Remote controlled", "Autonomous/sensor-guided"],
    };
  } else if (lower.includes("iot") || lower.includes("wifi") || lower.includes("cloud")) {
    firstQ = {
      id: "project_goal",
      text: "Where should the data be sent or accessed?",
      hint: "Shapes the communication architecture",
      options: ["Local web dashboard (browser)", "Mobile app (Bluetooth)", "Cloud service (MQTT/HTTP)", "Just serial monitor", "Not sure — suggest one"],
    };
  } else if (lower.includes("display") || lower.includes("oled") || lower.includes("lcd")) {
    firstQ = {
      id: "project_goal",
      text: "What should be shown on the display?",
      options: ["Sensor readings (live data)", "Clock / date / time", "Custom menu / UI", "Status indicators", "Not sure — suggest one"],
    };
  } else {
    firstQ = {
      id: "project_goal",
      text: `What is the main goal of your "${idea.slice(0, 40)}" project?`,
      hint: "Helps the AI understand your core use case",
      options: ["Monitor and display data", "Control something (motor/relay)", "Alert when threshold reached", "Log data over time", "Not sure — suggest one"],
    };
  }

  return [
    firstQ,
    {
      id: "mcu",
      text: "Which microcontroller do you prefer?",
      hint: "Affects code style and capabilities",
      options: ["Arduino (C++, beginner-friendly)", "ESP32 (WiFi/BT built-in)", "STM32 (advanced)", "Raspberry Pi (Python)", "Not sure — suggest one"],
    },
    {
      id: "hardware",
      text: "What hardware do you already have?",
      hint: "We'll design around what you own",
      options: ["Arduino Uno", "ESP32 DevKit V1", "Raspberry Pi", "Nothing yet — suggest parts", "Other parts (I'll specify)"],
    },
    {
      id: "power",
      text: "What power source is preferred?",
      options: ["USB wall adapter (fixed)", "Battery powered (portable)", "Solar powered (outdoor)", "PoE (Ethernet)", "Not sure"],
    },
    {
      id: "display",
      text: "How should data be displayed or accessed?",
      options: ["OLED/LCD display", "Serial monitor (PC only)", "Web dashboard", "LED indicators only", "No display needed"],
    },
    {
      id: "skill",
      text: "What is your experience level with electronics?",
      options: ["Complete beginner", "I've built a few projects", "Intermediate — comfortable with circuits", "Advanced engineer"],
    },
  ];
}
