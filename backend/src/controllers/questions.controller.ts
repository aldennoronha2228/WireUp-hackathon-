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
The questions must cover:
1. What hardware/parts they already have (MCU, sensors, etc.)
2. Preferred microcontroller/platform (Arduino, ESP32, Raspberry Pi, etc.)
3. Connectivity needs (WiFi, Bluetooth, LoRa, none)
4. Display/output method (OLED, LCD, LED, web dashboard, serial monitor)
5. Power source (USB, battery, solar, PoE)
6. Skill level / experience (beginner, intermediate, advanced)

For each question provide 4-5 answer options. Always include "Not sure — suggest one" as an option for hardware questions, and "Other..." for open-ended ones.

Return ONLY a valid JSON array in this exact format, no markdown:
[
  {
    "id": "hardware",
    "text": "What hardware do you already have?",
    "hint": "Select all that apply or choose what you'd prefer to use",
    "options": ["Arduino Uno", "ESP32 DevKit", "Raspberry Pi", "I don't have any — suggest parts", "Other..."]
  },
  ...
]`,
      }],
      model,
      800,
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

/* ── Default questions if LLM fails ────────────────────────────────────── */
function defaultQuestions(idea: string): Question[] {
  return [
    {
      id: "hardware",
      text: "What hardware do you already have?",
      hint: "This helps us use components you own",
      options: ["Arduino Uno", "ESP32 DevKit V1", "Raspberry Pi", "Nothing yet — suggest parts", "Other..."],
    },
    {
      id: "mcu",
      text: "Which microcontroller do you prefer?",
      hint: "Affects code style and capabilities",
      options: ["Arduino (C++)", "ESP32 (WiFi/BT built-in)", "STM32", "Raspberry Pi (Python)", "Not sure — suggest one"],
    },
    {
      id: "connectivity",
      text: "Does your project need wireless connectivity?",
      options: ["No — wired/local only", "WiFi", "Bluetooth", "LoRa (long range)", "Not sure"],
    },
    {
      id: "display",
      text: "How should data be displayed or accessed?",
      options: ["OLED/LCD display", "Serial monitor (PC only)", "Web dashboard", "Mobile app", "LED indicators only"],
    },
    {
      id: "power",
      text: "What power source is preferred?",
      options: ["USB wall adapter (fixed)", "Battery powered (portable)", "Solar powered (outdoor)", "PoE (Ethernet)", "Not sure"],
    },
    {
      id: "skill",
      text: "What is your experience level with electronics?",
      options: ["Complete beginner", "I've built a few projects", "Intermediate — comfortable with circuits", "Advanced engineer"],
    },
  ];
}
