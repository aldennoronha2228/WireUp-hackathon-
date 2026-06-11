const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  content.split("\n").forEach(line => {
    const parts = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (parts) {
      const key = parts[1];
      let val = (parts[2] || "").trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
      process.env[key] = val;
    }
  });
}

console.log("TOKENLB_API_KEY:", process.env.TOKENLB_API_KEY ? "Loaded (ends with " + process.env.TOKENLB_API_KEY.slice(-5) + ")" : "Not found");
console.log("TOKENLB_BASE_URL:", process.env.TOKENLB_BASE_URL);
console.log("BLUESMINDS_CONNECTION_STRING:", process.env.BLUESMINDS_CONNECTION_STRING ? "Loaded" : "Not found");
console.log("BLUESMINDS_API_KEY:", process.env.BLUESMINDS_API_KEY ? "Loaded (ends with " + process.env.BLUESMINDS_API_KEY.slice(-5) + ")" : "Not found");
console.log("BLUESMINDS_BASE_URL:", process.env.BLUESMINDS_BASE_URL);

function parseBluesmindsConfig() {
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
      console.warn("Failed to parse Bluesminds connection string JSON:", e.message);
    }
  }

  base = base.replace(/\/$/, "");
  if (base && base.includes("bluesminds.com") && !base.endsWith("/v1")) {
    base = `${base}/v1`;
  }
  return { key, base };
}

async function testEndpoint(name, base, key, model) {
  console.log(`\nTesting ${name} for model ${model}...`);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 10
      })
    });
    
    console.log(`Status: ${res.status} ${res.statusText}`);
    console.log("Headers:");
    res.headers.forEach((val, key) => {
      console.log(`  ${key}: ${val}`);
    });
    const text = await res.text();
    console.log(`Response: ${text}`);
  } catch (err) {
    console.error(`Fetch Error:`, err.message);
  }
}

async function listModels(name, base, key) {
  console.log(`\nListing models for ${name} (${base})...`);
  try {
    const res = await fetch(`${base}/models`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${key}`
      }
    });
    console.log(`Status: ${res.status} ${res.statusText}`);
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      const models = json.data?.map(m => m.id) || [];
      console.log(`Available models (${models.length}):`, models);
    } catch {
      console.log(`Response snippet (not JSON): ${text.slice(0, 300)}`);
    }
  } catch (err) {
    console.error(`Fetch Error:`, err.message);
  }
}

async function run() {
  const { key, base } = parseBluesmindsConfig();
  console.log("\nParsed Bluesminds Config:");
  console.log("  Key:", key ? "Loaded (ends with " + key.slice(-5) + ")" : "Not found");
  console.log("  Base URL:", base);

  if (key) {
    await testEndpoint("Bluesminds Parsed Config", base, key, "gpt-5-mini");
    await new Promise(r => setTimeout(r, 2000));
    await testEndpoint("Bluesminds Parsed Config", base, key, "gpt-3.5-turbo-0613");
  } else {
    console.log("No Bluesminds API key or connection string found to test.");
  }
}

run();
