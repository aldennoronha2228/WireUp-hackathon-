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
        content: `You are a hardware engineering assistant. A user wants to build:
"${idea.trim()}"

Your job: Generate 6 questions that ONLY make sense for THIS specific project. Every question must be directly about what they are building — not generic hardware questions.

RULES:
- Question 1: About the primary function/goal of this specific project
- Question 2: About the specific sensors/components this project needs
- Question 3: About the environment or use case (where/how will it be used)
- Question 4: About accuracy/precision/performance requirements
- Question 5: About how results/data should be presented
- Question 6: About any special constraints (size, cost, etc.)

For each question, provide 4-5 answer options that are SPECIFIC to this project.
Always include one option like "Not sure — let AI decide" for technical choices.

Example for a "temperature monitor project":
- Q1: "What temperature range does your sensor need to cover?" with options [-40°C to 80°C (indoor), -20°C to 50°C (home), 0°C to 300°C (industrial), Not sure]
- Q2: "How often should temperature be measured?" with options [Every second, Every 5 seconds, Every minute, Only when button pressed]
- NOT: "Which microcontroller do you prefer?" — that is TOO GENERIC

Return ONLY a valid JSON array, no markdown, no explanation:
[
  {
    "id": "q1",
    "text": "Question text here?",
    "hint": "Brief helper text",
    "options": ["Option A", "Option B", "Option C", "Option D", "Not sure — let AI decide"]
  }
]`,
      }],
      model,
      1000,
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

/* ── Smart fallback — project-specific questions based on keywords ─────── */
function defaultQuestions(idea: string): Question[] {
  const l = idea.toLowerCase();

  // ── Temperature / environment sensing ──────────────────────────────────
  if (l.match(/temp|humidity|dht|bmp|weather|climate|thermos/)) return [
    { id:"q1", text:"What temperature range do you need to measure?",
      options:["Indoor room (15-35°C)","Outdoor (-20 to 50°C)","Industrial (0-300°C)","Body temperature (35-42°C)","Not sure — let AI decide"] },
    { id:"q2", text:"How should temperature alerts be triggered?",
      options:["Buzzer when threshold crossed","LED indicator","Send phone notification","Log to SD card","No alerts needed"] },
    { id:"q3", text:"How often should readings be taken?",
      options:["Every second (real-time)","Every 5 seconds","Every minute","Only on button press","Not sure — let AI decide"] },
    { id:"q4", text:"Where will this device be placed?",
      options:["Fixed on a wall/desk","Portable (battery powered)","Outside (weatherproof)","Inside a machine","Not sure yet"] },
    { id:"q5", text:"How should readings be displayed?",
      options:["OLED/LCD screen","Web dashboard","Serial monitor only","LED colour indicator","Mobile app"] },
    { id:"q6", text:"Does it need to store historical data?",
      options:["Yes — log to SD card","Yes — send to cloud","Yes — store in EEPROM","No — live readings only","Not sure"] },
  ];

  // ── Robot / motor / servo ───────────────────────────────────────────────
  if (l.match(/robot|motor|servo|arm|wheeled|autonomous/)) return [
    { id:"q1", text:"How should the robot move?",
      options:["2 wheels (differential drive)","4 wheels (car style)","Legs (servo joints)","Tracks (tank style)","Stationary arm only"] },
    { id:"q2", text:"How will the robot be controlled?",
      options:["Bluetooth from phone","WiFi web interface","IR remote control","Autonomous (sensors only)","Joystick / buttons"] },
    { id:"q3", text:"What should the robot avoid or detect?",
      options:["Obstacles (ultrasonic)","Lines on floor (line follower)","Walls (IR sensors)","Nothing — simple movement","Not sure"] },
    { id:"q4", text:"What speed/load does it need to handle?",
      options:["Light — small toy","Medium — carry small objects","Heavy — industrial arm","Variable speed control","Not sure"] },
    { id:"q5", text:"How long should it run on one charge?",
      options:["Under 30 minutes","1-2 hours","4+ hours","Continuous (plugged in)","Not sure yet"] },
    { id:"q6", text:"Does the robot need a camera or vision?",
      options:["Yes — camera feed to phone","Yes — OpenCV object detection","Yes — simple IR/colour sensing","No vision needed","Not sure"] },
  ];

  // ── Smart home / automation ─────────────────────────────────────────────
  if (l.match(/smart|home|automati|relay|switch|light|control/)) return [
    { id:"q1", text:"What do you want to control or automate?",
      options:["Lights (on/off/dim)","Fan / air conditioner","Locks / security","Irrigation / water","Custom appliance"] },
    { id:"q2", text:"How will automation be triggered?",
      options:["Time schedule","Voice command","Sensor threshold","Mobile app button","Physical button"] },
    { id:"q3", text:"How many devices need to be controlled?",
      options:["1 single device","2-4 devices","5-10 devices","More than 10","Not sure yet"] },
    { id:"q4", text:"How will devices be connected?",
      options:["WiFi (ESP32/NodeMCU)","Bluetooth (short range)","Zigbee/Z-Wave","433MHz RF","Wired only"] },
    { id:"q5", text:"Do you need remote access from outside home?",
      options:["Yes — from anywhere via internet","Yes — local network only","No — just in the room","Not sure"] },
    { id:"q6", text:"What should happen during a power outage?",
      options:["Return to last state","Default to OFF/safe state","Battery backup","Send alert notification","Not important"] },
  ];

  // ── IoT / data logging / cloud ──────────────────────────────────────────
  if (l.match(/iot|data log|cloud|mqtt|dashboard|monitor/)) return [
    { id:"q1", text:"What data needs to be collected?",
      options:["Single sensor (one reading)","Multiple sensors","GPS location data","Images / video","Custom binary data"] },
    { id:"q2", text:"Where should data be sent?",
      options:["Local web server (browser)","Cloud (AWS/Azure/Firebase)","MQTT broker","Database (MySQL/InfluxDB)","SD card only"] },
    { id:"q3", text:"How often should data be uploaded?",
      options:["Real-time (every second)","Every minute","Every hour","On event/trigger only","Not sure"] },
    { id:"q4", text:"How many nodes/devices will send data?",
      options:["Just 1 device","2-5 devices","6-20 devices","50+ devices (mesh)","Not sure yet"] },
    { id:"q5", text:"Should the device work offline too?",
      options:["Yes — store locally when offline","Yes — full offline mode","No — always online","Not sure"] },
    { id:"q6", text:"Does it need to send alerts?",
      options:["Email alerts","Push notifications","SMS","Telegram/WhatsApp bot","No alerts needed"] },
  ];

  // ── Display / screen project ────────────────────────────────────────────
  if (l.match(/display|screen|oled|lcd|tft|clock|weather station/)) return [
    { id:"q1", text:"What should be shown on the display?",
      options:["Real-time sensor data","Clock and date","Weather information","Custom menu/UI","Scrolling text/announcements"] },
    { id:"q2", text:"What display size do you prefer?",
      options:["Tiny OLED 0.96\" (128x64)","Small LCD 16x2 characters","Medium TFT 2.4\" colour","Large 3.5\"+ touchscreen","Not sure — suggest one"] },
    { id:"q3", text:"How often should the display update?",
      options:["Every second","Every 5 seconds","Every minute","Only on new data","On button press"] },
    { id:"q4", text:"Should the display have interactive buttons?",
      options:["Yes — physical buttons to navigate","Yes — touchscreen","No — display only","Rotary encoder / knob","Not sure"] },
    { id:"q5", text:"Will it run continuously or sleep to save power?",
      options:["Always on","Sleep + wake on motion/button","Scheduled on/off","Low-power always-on","Battery powered — maximize life"] },
    { id:"q6", text:"Any specific visual style needed?",
      options:["Minimal — data only","Charts / graphs","Custom icons","Dark mode (OLED)","No preference"] },
  ];

  // ── Generic fallback ────────────────────────────────────────────────────
  return [
    { id:"q1", text:`What is the primary goal of your project?`,
      hint:"Describe the core functionality",
      options:["Measure and display data","Control something (motor/relay/LED)","Send alerts when something happens","Log data over time","Not sure — let AI decide"] },
    { id:"q2", text:"What is the most important performance requirement?",
      options:["High accuracy / precision","Fast response time","Long battery life","Low cost","Small physical size"] },
    { id:"q3", text:"Where will this project be used?",
      options:["Indoor — on a desk or wall","Outdoor — needs weather protection","Portable — carried around","Inside a machine or enclosure","Multiple locations"] },
    { id:"q4", text:"How should results or outputs be shown?",
      options:["Screen/display (OLED/LCD)","LED lights or indicators","Web page / dashboard","Buzzer or sound","No output needed"] },
    { id:"q5", text:"What is your budget range for components?",
      options:["Under $10 (very minimal)","$10-25 (basic project)","$25-50 (mid range)","$50+ (quality components)","No budget limit"] },
    { id:"q6", text:"Does this project need to connect to other devices?",
      options:["No — standalone only","Yes — to my phone","Yes — to a computer","Yes — to the internet","Yes — to other sensors/devices"] },
  ];
}
