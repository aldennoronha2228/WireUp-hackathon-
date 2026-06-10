// ??$$$
import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import rotationService from "../../services/keyRotation.service";
import { deriveBOMKey } from "../../utils/bom.utils";
import { getAIContext, getRegistry } from "../../services/registry.services";
import { buildWokwiEvidenceText } from "../../services/wokwi-runner.service";
import {
  safeParse,
  stripThinking,
  recoverGeneratedAssetsFromText
} from "../shared/jsonRepair";

import {
  cleanArray,
  cleanText,
  normalizeBoardToRegistryKey,
  getAllowedBoardKeysFromRegistry,
  pickDefaultBoardKeyFromRegistry,
  buildFallbackIdeationReply,
  buildIdeationParseFallback,
  applyIdeationGuards,
  enforceCatalogForIdeation,
  detectBoardFromRequirements,
  detectPowerSourceFromRequirements,
  normalizeArchitectureState,
  buildGenerationProfileFromMeta,
  normalizeComponentsOutput,
  enforceCatalogForComponents,
  normalizeDesignOutput,
  isSimonProjectFromData,
  buildSimonGameSketchFromData,
  buildSimonGameDiagramFromData,
  normalizeGeneratedAssetsOutput,
  applyDeterministicBoardProfile,
  validateGeneratedAssets,
  normalizeCustomChipTemplateOutput,
  buildFallbackCustomChipTemplate,
  normalizeIdeationOutput,
  fallbackGeneratedSketch,
  fallbackGeneratedDiagram
} from "./discovery.utils";

import {
  buildIdeationPrompt,
  buildComponentsPrompt,
  buildDesignPrompt,
  buildSketchOnlyPrompt,
  buildDiagramOnlyPrompt,
  buildWokwiAssetsPrompt,
  buildCustomChipPrompt
} from "./discovery.prompts";

const QWEN_MODEL = "qwen-2.5-32b";
const FALLBACK_MODEL = process.env.GROQ_MODEL_1 || "llama-3.3-70b-versatile";

const getGroqClient = async (): Promise<any> => {
  return await rotationService.getClient();
};

const callAI = async (prompt: string, model: string | null = null, retryCount = 0, offset = 0): Promise<string> => {
  const selectedModel = model || QWEN_MODEL;
  const groq = await rotationService.getClient(offset);

  const baseArgs = {
    model: selectedModel,
    messages: [
      { role: "system", content: "Return ONLY valid JSON. No markdown. No prose. No <think>." },
      { role: "user", content: prompt }
    ],
    temperature: 0.2
  };

  try {
    let res;
    try {
      res = await (groq as any).chat.completions.create({
        ...baseArgs,
        response_format: { type: "json_object" }
      });
    } catch {
      res = await (groq as any).chat.completions.create(baseArgs);
    }
    return res.choices[0].message.content.trim();
  } catch (err: any) {
    console.warn(`[callAI] Groq failed for ${selectedModel}:`, err.message || err);
    
    // Try Gemini fallback first
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (geminiApiKey) {
      try {
        console.log("[callAI] Attempting Gemini fallback...");
        const genAI = new GoogleGenerativeAI(geminiApiKey);
        const geminiModel = genAI.getGenerativeModel({
          model: "gemini-2.5-flash",
          systemInstruction: "Return ONLY valid JSON. No markdown. No prose. No <think>.",
          generationConfig: { responseMimeType: "application/json" }
        });
        const result = await geminiModel.generateContent(prompt);
        return result.response.text().trim();
      } catch (geminiErr) {
        console.error("[callAI] Gemini fallback failed:", geminiErr);
      }
    }

    // Handle 429 Rate Limit or Error with Groq
    if ((err?.status === 429 || err?.status === 400) && retryCount < 3) {
      console.warn(`[callAI] Error with ${selectedModel} (status ${err?.status}). Retrying Groq...`);
      
      const nextModel = (selectedModel === QWEN_MODEL) ? FALLBACK_MODEL : selectedModel;
      
      if (err?.status === 429) {
        await rotationService.handleRateLimit();
      }
      
      return await callAI(prompt, nextModel, retryCount + 1, offset);
    }
    throw err;
  }
};

export const extractHardwareContext = async (messages: any[]) => {
  const history = (messages || []).map(m => `${m.role}: ${m.content}`).join("\n");
  const prompt = `
  You are an expert hardware engineer. Analyze the following conversation about an IoT/hardware project.
  Extract the structured context of the project.
  
  Return ONLY valid JSON matching this schema exactly:
  {
    "board": "Name of the main board (e.g., 'Arduino Uno', 'ESP32') or null",
    "sensors": ["List", "of", "sensors"],
    "outputs": ["List", "of", "outputs", "like", "motors", "LEDs"],
    "connectivity": "wifi, bluetooth, lora, or null",
    "power": "usb, battery, both, or null",
    "projectSummary": "1-2 sentence summary of what it does",
    "confidence": {
      "board": 0.9,
      "sensors": 0.8,
      "outputs": 0.8,
      "connectivity": 0.2,
      "power": 0.1,
      "projectSummary": 0.9
    }
  }
  
  Set confidence between 0.0 and 1.0. If a field is not discussed, set its confidence to < 0.4.
  
  Conversation:
  ${history}
  `;

  try {
    const groq = await getGroqClient();
    const res = await (groq as any).chat.completions.create({
      model: process.env.GROQ_MODEL || "gpt-4o",
      messages: [
        { role: "system", content: "Return ONLY valid JSON. No markdown." },
        { role: "user", content: prompt }
      ],
      temperature: 0.1,
      response_format: { type: "json_object" }
    });
    return safeParse(res.choices[0].message.content);
  } catch (err) {
    console.error("extractHardwareContext failed:", err);
    return null;
  }
};

export const generateCustomChipTemplate = async ({ project, chipName = "", purpose = "", userPrompt = "" }: any) => {
  const fallback = buildFallbackCustomChipTemplate({ chipName, purpose: purpose || userPrompt });

  const prompt = buildCustomChipPrompt(project, chipName, purpose, userPrompt);

  try {
    const text = await callAI(prompt);
    const parsed = safeParse(text);
    return normalizeCustomChipTemplateOutput(parsed, fallback);
  } catch {
    return fallback;
  }
};

export const processInput = async (project: any, userInput: string) => {
  const messagesText = project.messages
    .map((m: any) => `${m.role}: ${m.content}`)
    .join("\n");

  const allowedBoardKeys = getAllowedBoardKeysFromRegistry();
  const prompt = buildIdeationPrompt(project, messagesText, userInput, allowedBoardKeys);

  const text = await callAI(prompt, process.env.GROQ_MODEL_1);

  let parsed;
  try {
    parsed = safeParse(text);
  } catch (error: any) {
    console.error("Ideation parse fallback:", error?.message || error);
    parsed = buildIdeationParseFallback({
      project,
      userInput,
      rawText: text
    });
  }

  const normalized = normalizeIdeationOutput(parsed, userInput);
  const guarded = applyIdeationGuards(project, userInput, normalized);

  if (guarded.question && typeof guarded.assistantReply === 'string') {
    const qMatches = guarded.assistantReply.match(/\?+/g) || [];
    if (qMatches.length > 1) {
      const parts = guarded.assistantReply.split(/(?<=[.!?])\s+/);
      const firstQ = parts.find(p => p.includes('?')) || parts[0];
      guarded.assistantReply = firstQ.trim();
    }
  }

  const forbiddenQuestionPatterns = [/pin\b/i, /wire/i, /resistor/i, /pull-?up/i, /pull-?down/i, /which pin/i, /wiring/i, /wire color/i];
  if (guarded.question && forbiddenQuestionPatterns.some(rx => rx.test(guarded.question))) {
    guarded.question = "";
    guarded.unknowns = (guarded.unknowns || []).filter(u => !forbiddenQuestionPatterns.some(rx => rx.test(u)));
  }
  const catalogSafe = enforceCatalogForIdeation(guarded);

  const detectedBoardKeyRaw = detectBoardFromRequirements(catalogSafe.requirements);
  const detectedBoardKey = detectedBoardKeyRaw && allowedBoardKeys.includes(detectedBoardKeyRaw)
    ? detectedBoardKeyRaw
    : null;

  return {
    ...catalogSafe,
    architectureState: normalizeArchitectureState(catalogSafe.architectureState, {
      project,
      summary: catalogSafe.summary,
      requirements: catalogSafe.requirements,
      unknowns: catalogSafe.unknowns
    }),
    detectedMeta: {
      board: detectedBoardKey,
      powerSource: detectPowerSourceFromRequirements(guarded.requirements),
      language: guarded.requirements.join(" ").toLowerCase().includes("micropython") ? "micropython" : "cpp",
      componentCount: guarded.requirements.length,
      detectedAt: new Date()
    }
  };
};

export const processComponents = async (project: any, userInput: string) => {
  const messagesText = (project.componentsMessages || [])
    .map((m: any) => `${m.role}: ${m.content}`)
    .join("\n");
  const runnerEvidence = buildWokwiEvidenceText(project);
  const ideationMeta = project?.meta || {};
  const generationProfile = project?.generationProfile || buildGenerationProfileFromMeta(ideationMeta);
  
  let registryContext = getAIContext();
  const contextString = JSON.stringify(registryContext);
  
  if (contextString.length > 15000) {
    const mentioned = (project.description + messagesText + JSON.stringify(project.ideation?.snapshot || {})).toLowerCase();
    registryContext = registryContext.filter((c: any) => 
      c.category === 'controller' || 
      mentioned.includes(c.name.toLowerCase()) ||
      mentioned.includes(c.type.toLowerCase())
    );
  }

  const prompt = buildComponentsPrompt(project, messagesText, userInput, runnerEvidence, ideationMeta, generationProfile, registryContext);

  const text = await callAI(prompt);

  try {
    const parsed = safeParse(text);
    const normalized = normalizeComponentsOutput(parsed, project, stripThinking(text));
    return enforceCatalogForComponents(normalized);
  } catch {
    const normalized = normalizeComponentsOutput({}, project, stripThinking(text));
    return enforceCatalogForComponents(normalized);
  }
};

export const processDesign = async (project: any, userInput: string, wokwiContext: any = null) => {
  const messagesText = (project.designMessages || [])
    .map((m: any) => `${m.role}: ${m.content}`)
    .join("\n");
  const runnerEvidence = buildWokwiEvidenceText(project);

  const prompt = buildDesignPrompt(project, messagesText, userInput, wokwiContext, runnerEvidence);

  const text = await callAI(prompt);
  const livePartTypes = ((wokwiContext as any)?.partTypes || []).map((item: any) => String(item).toLowerCase());

  const hasPartType = (pattern: RegExp) => livePartTypes.some((part: string) => pattern.test(part));
  const missingMentions: string[] = [];

  const buildMissingPartsCorrection = () => {
    const partsLabel = livePartTypes.length > 0 ? livePartTypes.join(", ") : "unknown";
    return `Live Wokwi context does not include: ${missingMentions.join(", ")}. I will only guide using existing circuit parts. Current live part types: ${partsLabel}.`;
  };

  const enforceLiveParts = (replyText: string) => {
    if (!wokwiContext?.connected) return replyText;

    const textValue = String(replyText || "");
    missingMentions.length = 0;

    if (/\bservo\b/i.test(textValue) && !hasPartType(/servo/)) {
      missingMentions.push("servo");
    }
    if (/\bbattery\b|\b9v\b/i.test(textValue) && !hasPartType(/battery/)) {
      missingMentions.push("battery");
    }

    if (missingMentions.length > 0) {
      return buildMissingPartsCorrection();
    }

    return textValue;
  };

  try {
    const parsed = safeParse(text);
    const normalized = normalizeDesignOutput(parsed, stripThinking(text));

    if (/there\s+is\s+no|no\s+9v\s+battery|not\s+present/i.test(String(userInput))) {
      const hasBattery = livePartTypes.some((part: string) => part.includes("battery"));
      if (!hasBattery) {
        normalized.reply = "You are correct - there is no battery in the current live Wokwi circuit context. I will only use existing parts unless you explicitly ask to add new ones. Next step: tell me which current part you want to wire or debug.";
      }
    }

    normalized.reply = enforceLiveParts(normalized.reply);

    return normalized;
  } catch {
    const fallback = normalizeDesignOutput({}, stripThinking(text));
    fallback.reply = enforceLiveParts(fallback.reply);
    return fallback;
  }
};

export const generateWokwiAssetsFromState = async ({ project, userPrompt = "" }: any) => {
  if (isSimonProjectFromData(project)) {
    return normalizeGeneratedAssetsOutput({
      sketchIno: buildSimonGameSketchFromData(project),
      diagramJson: buildSimonGameDiagramFromData(project),
      notes: ["Generated from project JSON data using the Simon hardware profile."]
    });
  }

  const ideationContext = JSON.stringify(project?.ideation?.snapshot || {});
  const componentsContext = JSON.stringify(project?.componentsState || {});
  const ideationMeta = project?.meta || {};
  const ideationMessages = (project?.messages || []).slice(-6).map((m: any) => `${m.role}: ${m.content}`).join("\n");
  const componentsMessages = (project?.componentsMessages || []).slice(-10).map((m: any) => `${m.role}: ${m.content}`).join("\n");
  const registryContext = getAIContext();
  const generationProfile = project?.generationProfile || buildGenerationProfileFromMeta(ideationMeta);

  const prompt = buildWokwiAssetsPrompt(
    project,
    ideationContext,
    componentsContext,
    ideationMeta,
    ideationMessages,
    componentsMessages,
    registryContext,
    generationProfile,
    userPrompt
  );

  try {
    const text = await callAI(prompt, QWEN_MODEL, 0, 0);

    let parsedPayload;
    try {
      parsedPayload = safeParse(text);
    } catch {
      parsedPayload = recoverGeneratedAssetsFromText(text);
    }

    const normalized = normalizeGeneratedAssetsOutput(
      parsedPayload || {
        sketchIno: fallbackGeneratedSketch,
        diagramJson: fallbackGeneratedDiagram,
        notes: ["Fallback template used because AI output could not be parsed."]
      }
    );

    const deterministic = applyDeterministicBoardProfile({
      assets: normalized,
      meta: ideationMeta
    });

    const validated = validateGeneratedAssets({
      sketchIno: deterministic.sketchIno,
      diagramJson: deterministic.diagramJson,
      meta: ideationMeta
    });

    return {
      ...deterministic,
      notes: validated.ok
        ? deterministic.notes
        : [...new Set([...deterministic.notes, `Validation issues: ${validated.issues.join("; ")}`])]
    };
  } catch {
    const normalized = normalizeGeneratedAssetsOutput({
      sketchIno: fallbackGeneratedSketch,
      diagramJson: fallbackGeneratedDiagram,
      notes: ["Fallback template used because generation failed before parse."]
    });

    return applyDeterministicBoardProfile({
      assets: normalized,
      meta: ideationMeta
    });
  }
};

export const generateSketchOnly = async (project: any) => {
  const prompt = buildSketchOnlyPrompt(project);
  const text = await callAI(prompt, QWEN_MODEL, 0, 1);
  return stripThinking(text);
};

export const generateDiagramOnly = async (project: any) => {
  const prompt = buildDiagramOnlyPrompt(project);
  const text = await callAI(prompt, QWEN_MODEL, 0, 2);
  let parsed = safeParse(text);
  
  if (parsed && parsed.diagram && Array.isArray(parsed.diagram.parts)) {
    parsed = parsed.diagram;
  } else if (parsed && parsed.diagramJson && Array.isArray(parsed.diagramJson.parts)) {
    parsed = parsed.diagramJson;
  }
  
  return parsed;
};

export const validatePinSync = (sketch: string, diagram: any) => {
  if (!sketch || !diagram) return [];
  const warnings: string[] = [];
  const diag = typeof diagram === 'string' ? JSON.parse(diagram) : diagram;
  
  const connectedPins = new Set();
  (diag.connections || []).forEach((conn: any) => {
    connectedPins.add(conn[0].split(':')[1]);
    connectedPins.add(conn[1].split(':')[1]);
  });

  const pinRegex = /(?:pinMode|digitalWrite|digitalRead|analogRead|analogWrite|Servo\.attach)\s*\(\s*(\w+)/g;
  let match;
  const usedInCode = new Set<string>();
  while ((match = pinRegex.exec(sketch)) !== null) {
    const val = match[1];
    if (/^\d+$/.test(val)) {
      usedInCode.add(val);
    } else {
      const defRegex = new RegExp(`(?:const|int|#define)\\s+${val}\\s*=?\\s*(\\d+)`, 'i');
      const defMatch = sketch.match(defRegex);
      if (defMatch) {
        usedInCode.add(defMatch[1]);
      }
    }
  }

  usedInCode.forEach(pin => {
    if (!connectedPins.has(pin)) {
      warnings.push(`Pin ${pin} is used in the sketch but has no connection in the diagram.`);
    }
  });

  return warnings;
};
