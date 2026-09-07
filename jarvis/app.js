const STORAGE_KEY = "jarvis_local_memory_v1";
const CHAT_KEY = "jarvis_local_chat_v1";
const MODEL_ID = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
const messages = document.querySelector("#messages");
const form = document.querySelector("#chatForm");
const input = document.querySelector("#input");
const send = document.querySelector("#send");
const clear = document.querySelector("#clear");
const status = document.querySelector("#status");
const statusDot = status?.previousElementSibling;

let engine = null;
let enginePromise = null;

function loadJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function saveJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function loadMemory() { return loadJson(STORAGE_KEY, {}); }
function saveMemory(memory) { saveJson(STORAGE_KEY, memory); }

function setStatus(text, active = false) {
  status.textContent = text;
  if (statusDot) statusDot.style.background = active ? "#69d8ff" : "#657180";
}

function addMessage(role, text, persist = true) {
  const article = document.createElement("article");
  article.className = `message ${role}`;
  const label = document.createElement("span");
  label.className = "label";
  label.textContent = role === "user" ? "YOU" : "JARVIS";
  const p = document.createElement("p");
  p.textContent = text;
  article.append(label, p);
  messages.appendChild(article);
  messages.scrollTop = messages.scrollHeight;
  if (persist) saveJson(CHAT_KEY, Array.from(messages.querySelectorAll(".message")).map(m => ({
    role: m.classList.contains("user") ? "user" : "jarvis",
    text: m.querySelector("p")?.textContent || ""
  })));
  return p;
}

function restoreChat() {
  const history = loadJson(CHAT_KEY, []);
  if (!Array.isArray(history) || !history.length) return;
  messages.innerHTML = "";
  history.slice(-100).forEach(item => addMessage(item.role === "user" ? "user" : "jarvis", String(item.text), false));
}

function calculate(expression) {
  const cleaned = expression.replace(/×/g, "*").replace(/÷/g, "/").trim();
  if (!cleaned || cleaned.length > 100 || !/^[0-9+\-*/%().\s]+$/.test(cleaned)) return null;
  try {
    const value = Function(`"use strict"; return (${cleaned})`)();
    if (!Number.isFinite(value)) return null;
    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(10)));
  } catch { return null; }
}

function systemInfo() {
  const nav = navigator;
  return [
    `Browser: ${nav.userAgentData?.brands?.map(x => `${x.brand} ${x.version}`).join(", ") || nav.appName}`,
    `Platform: ${nav.userAgentData?.platform || nav.platform || "Unknown"}`,
    `Language: ${nav.language}`,
    `Online: ${nav.onLine ? "Yes" : "No"}`,
    `WebGPU: ${"gpu" in navigator ? "Available" : "Unavailable"}`,
    `CPU cores exposed: ${nav.hardwareConcurrency || "Unknown"}`,
    `Memory exposed: ${nav.deviceMemory ? `${nav.deviceMemory} GB` : "Not exposed"}`,
    `Screen: ${screen.width} × ${screen.height}`,
    `Viewport: ${window.innerWidth} × ${window.innerHeight}`
  ].join("\n");
}

function localResponse(raw) {
  const text = raw.trim();
  const lower = text.toLowerCase();
  const memory = loadMemory();

  if (lower === "help" || lower === "commands") return "Available commands:\n• help\n• time\n• date\n• system info\n• calculate <expression>\n• remember <key> = <value>\n• forget <key>\n• memory\n• clear memory\n• clear\n\nFor normal questions, JARVIS uses the local browser AI when WebGPU is available.";
  if (lower === "time" || lower === "what time is it") return `The local time is ${new Intl.DateTimeFormat(undefined, { timeStyle: "medium" }).format(new Date())}.`;
  if (lower === "date") return `Today is ${new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(new Date())}.`;
  if (lower === "system info" || lower === "system information") return systemInfo();
  if (lower === "memory" || lower === "what do you remember" || lower === "what do you remember?") {
    const entries = Object.entries(memory);
    return entries.length ? entries.map(([key, value]) => `• ${key}: ${value}`).join("\n") : "Memory is empty. Tell me: remember <key> = <value>.";
  }
  if (lower === "clear memory") {
    localStorage.removeItem(STORAGE_KEY);
    return "All local JARVIS memories have been cleared.";
  }

  const remember = text.match(/^remember\s+(.+?)\s*=\s*(.+)$/i);
  if (remember) {
    const key = remember[1].trim(), value = remember[2].trim();
    if (!key || key.length > 100 || value.length > 1000) return "That memory is too large to save.";
    memory[key] = value;
    saveMemory(memory);
    return `Remembered: ${key} = ${value}`;
  }

  const forget = text.match(/^forget\s+(.+)$/i);
  if (forget) {
    const key = forget[1].trim();
    if (!(key in memory)) return `I don't have a memory called “${key}”.`;
    delete memory[key];
    saveMemory(memory);
    return `Forgotten: ${key}.`;
  }

  const calc = text.match(/^(?:calculate|calc)\s+(.+)$/i);
  if (calc) {
    const result = calculate(calc[1]);
    return result === null ? "I couldn't safely evaluate that expression." : `Result: ${result}`;
  }

  if (/^(hi|hello|hey|good morning|good evening)\b/i.test(text)) return "Good to see you. Systems are nominal.";
  if (lower.includes("who are you")) return "I am JARVIS — your browser-based VoidForge assistant. I can now use a local AI model when WebGPU is available.";
  if (lower.includes("thank")) return "You're very welcome.";

  return null;
}

async function loadAI() {
  if (engine) return engine;
  if (enginePromise) return enginePromise;

  if (!("gpu" in navigator)) {
    throw new Error("WebGPU is not available in this browser.");
  }

  enginePromise = (async () => {
    setStatus("AI · LOADING MODEL", true);
    const { CreateMLCEngine } = await import("https://esm.run/@mlc-ai/web-llm");
    const loaded = await CreateMLCEngine(MODEL_ID, {
      initProgressCallback: progress => {
        const percent = Math.round((progress.progress || 0) * 100);
        setStatus(`AI · LOADING ${percent}%`, true);
      }
    });
    engine = loaded;
    setStatus("AI · LOCAL READY", true);
    return engine;
  })();

  try {
    return await enginePromise;
  } catch (error) {
    enginePromise = null;
    setStatus("BROWSER MODE · READY", false);
    throw error;
  }
}

function conversationForAI() {
  const history = Array.from(messages.querySelectorAll(".message")).slice(-20);
  return history.map(message => ({
    role: message.classList.contains("user") ? "user" : "assistant",
    content: message.querySelector("p")?.textContent || ""
  }));
}

async function askAI(userText) {
  const ai = await loadAI();
  const memoryEntries = Object.entries(loadMemory()).slice(0, 30);
  const memoryText = memoryEntries.length
    ? memoryEntries.map(([key, value]) => `${key}: ${value}`).join("\n")
    : "No saved memories.";

  const response = await ai.chat.completions.create({
    messages: [
      {
        role: "system",
        content: `You are JARVIS, a calm, intelligent, concise personal assistant for VoidForge Studios. Be helpful and confident without pretending to know things you do not know. Use subtle British phrasing when natural. Never claim to have performed an action you cannot perform. You are running entirely inside the user's browser.\n\nSaved local memories:\n${memoryText}`
      },
      ...conversationForAI(),
      { role: "user", content: userText }
    ],
    temperature: 0.55,
    max_tokens: 384
  });

  return response.choices?.[0]?.message?.content?.trim() || "I was unable to produce a response.";
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  const userText = input.value.trim();
  if (!userText) return;

  addMessage("user", userText);
  input.value = "";
  send.disabled = true;

  try {
    const local = localResponse(userText);
    if (local !== null) {
      addMessage("jarvis", local);
      setStatus(engine ? "AI · LOCAL READY" : "BROWSER MODE · READY", Boolean(engine));
    } else {
      const reply = await askAI(userText);
      addMessage("jarvis", reply);
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown AI error.";
    addMessage("jarvis", `I could not start the local AI. ${reason} Try a recent Chrome or Edge browser with WebGPU enabled.`);
    setStatus("AI · UNAVAILABLE", false);
  } finally {
    send.disabled = false;
    input.focus();
  }
});

clear.addEventListener("click", () => {
  messages.innerHTML = "";
  localStorage.removeItem(CHAT_KEY);
  addMessage("jarvis", "Conversation cleared. Local memories remain intact.");
});

input.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

restoreChat();
setStatus("BROWSER MODE · READY", false);
