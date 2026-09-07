const STORAGE_KEY = "jarvis_local_memory_v1";
const CHAT_KEY = "jarvis_local_chat_v1";
const messages = document.querySelector("#messages");
const form = document.querySelector("#chatForm");
const input = document.querySelector("#input");
const send = document.querySelector("#send");
const clear = document.querySelector("#clear");

function loadJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function saveJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function loadMemory() { return loadJson(STORAGE_KEY, {}); }
function saveMemory(memory) { saveJson(STORAGE_KEY, memory); }

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
    `CPU cores exposed: ${nav.hardwareConcurrency || "Unknown"}`,
    `Memory exposed: ${nav.deviceMemory ? `${nav.deviceMemory} GB` : "Not exposed"}`,
    `Screen: ${screen.width} × ${screen.height}`,
    `Viewport: ${window.innerWidth} × ${window.innerHeight}`
  ].join("\n");
}

function respond(raw) {
  const text = raw.trim();
  const lower = text.toLowerCase();
  const memory = loadMemory();

  if (lower === "help" || lower === "commands") return "Available commands:\n• help\n• time\n• date\n• system info\n• calculate <expression>\n• remember <key> = <value>\n• forget <key>\n• memory\n• clear memory\n• clear";
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
  if (lower.includes("who are you")) return "I am JARVIS — your browser-based VoidForge assistant. This edition runs locally without a server.";
  if (lower.includes("what can you do")) return "I can handle local memories, arithmetic, date/time, browser/device telemetry, and this conversation — entirely in the browser.";
  if (lower.includes("thank")) return "You're very welcome.";

  return "I'm in local browser mode, so I can't access external services or an AI model yet. Try “help” to see what I can do locally.";
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  const message = input.value.trim();
  if (!message) return;
  addMessage("user", message);
  input.value = "";
  send.disabled = true;
  await new Promise(resolve => setTimeout(resolve, 180));
  addMessage("jarvis", respond(message));
  send.disabled = false;
  input.focus();
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
