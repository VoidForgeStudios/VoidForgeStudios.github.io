const STORAGE_KEY = "jarvis_local_memory_v1";
const CHAT_KEY = "jarvis_local_chat_v1";
const GROQ_KEY = "jarvis_groq_api_key_session";
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "openai/gpt-oss-120b";

const messages = document.querySelector("#messages");
const form = document.querySelector("#chatForm");
const input = document.querySelector("#input");
const send = document.querySelector("#send");
const clear = document.querySelector("#clear");
const status = document.querySelector("#status");
const statusDot = status?.previousElementSibling;
const groqKey = document.querySelector("#groqKey");
const connect = document.querySelector("#connect");

function loadJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function saveJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function loadMemory() { return loadJson(STORAGE_KEY, {}); }
function saveMemory(memory) { saveJson(STORAGE_KEY, memory); }

function getGroqKey() {
  try { return sessionStorage.getItem(GROQ_KEY) || ""; } catch { return ""; }
}

function setGroqKey(value) {
  if (value) sessionStorage.setItem(GROQ_KEY, value);
  else sessionStorage.removeItem(GROQ_KEY);
}

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

  if (lower === "help" || lower === "commands") return "Available commands:\n• help\n• time\n• date\n• system info\n• calculate <expression>\n• remember <key> = <value>\n• forget <key>\n• memory\n• clear memory\n• clear\n\nNormal questions are sent to Groq when connected.";
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

  return null;
}

function conversationForAI() {
  return Array.from(messages.querySelectorAll(".message"))
    .slice(-20)
    .map(message => ({
      role: message.classList.contains("user") ? "user" : "assistant",
      content: message.querySelector("p")?.textContent || ""
    }));
}

async function askGroq(userText) {
  const apiKey = getGroqKey();
  if (!apiKey) throw new Error("Groq is not connected. Enter your API key above.");

  const memoryEntries = Object.entries(loadMemory()).slice(0, 30);
  const memoryText = memoryEntries.length
    ? memoryEntries.map(([key, value]) => `${key}: ${value}`).join("\n")
    : "No saved memories.";

  setStatus("GROQ · THINKING", true);

  const response = await fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.55,
      max_completion_tokens: 768,
      messages: [
        {
          role: "system",
          content: `You are JARVIS, a calm, intelligent, concise personal assistant for VoidForge Studios. Be helpful and confident without false certainty. Use subtle British phrasing when natural. Never claim to have performed an action you cannot perform. You are connected to the user through a browser interface.\n\nSaved local memories:\n${memoryText}`
        },
        ...conversationForAI()
      ]
    })
  });

  if (!response.ok) {
    let detail = "Groq request failed.";
    try {
      const error = await response.json();
      detail = error?.error?.message || detail;
    } catch { /* keep generic message */ }
    throw new Error(detail);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content?.trim() || "I was unable to produce a response.";
}

function updateConnectionUI() {
  const connected = Boolean(getGroqKey());
  if (groqKey) groqKey.value = connected ? "••••••••••••••••" : "";
  if (connect) connect.textContent = connected ? "Disconnect" : "Connect";
  setStatus(connected ? "GROQ · READY" : "GROQ · NOT CONNECTED", connected);
}

connect.addEventListener("click", () => {
  if (getGroqKey()) {
    setGroqKey("");
    groqKey.value = "";
    updateConnectionUI();
    return;
  }

  const key = groqKey.value.trim();
  if (!key) {
    groqKey.focus();
    return;
  }

  setGroqKey(key);
  groqKey.value = "";
  updateConnectionUI();
});

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
      updateConnectionUI();
    } else {
      const reply = await askGroq(userText);
      addMessage("jarvis", reply);
      setStatus("GROQ · READY", true);
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown Groq error.";
    addMessage("jarvis", `I could not reach Groq. ${reason}`);
    updateConnectionUI();
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
updateConnectionUI();
