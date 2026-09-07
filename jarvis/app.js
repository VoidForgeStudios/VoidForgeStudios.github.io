const messages = document.querySelector("#messages");
const form = document.querySelector("#chatForm");
const input = document.querySelector("#input");
const send = document.querySelector("#send");
const status = document.querySelector("#status");
const clear = document.querySelector("#clear");

const memoryKey = "jarvis_memory";

function loadMemory() {
  try {
    return JSON.parse(localStorage.getItem(memoryKey) || "{}");
  } catch {
    return {};
  }
}

function saveMemory(memory) {
  localStorage.setItem(memoryKey, JSON.stringify(memory));
}

function addMessage(role, text) {
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
}

function calculate(expression) {
  if (!/^[0-9+\-*/().%\s]+$/.test(expression)) return null;
  try {
    const result = Function(`"use strict"; return (${expression})`)();
    return Number.isFinite(result) ? String(result) : null;
  } catch {
    return null;
  }
}

function respond(message) {
  const text = message.trim();
  const lower = text.toLowerCase();

  if (lower === "help") {
    return "Available: system info, calculate <expression>, remember <key> = <value>, forget <key>, memory, clear, time.";
  }

  if (lower === "system info") {
    return `Browser: ${navigator.userAgentData?.platform || navigator.platform || "unknown"}. Online: ${navigator.onLine ? "yes" : "no"}. Local web mode active.`;
  }

  if (lower === "time") {
    return `Local time: ${new Date().toLocaleString()}.`;
  }

  if (lower === "memory") {
    const memory = loadMemory();
    const entries = Object.entries(memory);
    return entries.length
      ? entries.map(([key, value]) => `${key}: ${value}`).join("\n")
      : "No memories stored.";
  }

  const calc = lower.startsWith("calculate ") ? calculate(text.slice(10).trim()) : null;
  if (calc !== null) return calc;
  if (lower.startsWith("calculate ")) return "I could not safely evaluate that expression.";

  const remember = text.match(/^remember\s+(.+?)\s*=\s*(.+)$/i);
  if (remember) {
    const memory = loadMemory();
    memory[remember[1].trim()] = remember[2].trim();
    saveMemory(memory);
    return `Remembered ${remember[1].trim()}.`;
  }

  const forget = text.match(/^forget\s+(.+)$/i);
  if (forget) {
    const memory = loadMemory();
    const key = forget[1].trim();
    if (!(key in memory)) return `I have no stored memory named ${key}.`;
    delete memory[key];
    saveMemory(memory);
    return `Forgot ${key}.`;
  }

  if (lower === "clear") {
    return "Use the Clear button to clear this conversation.";
  }

  return "I'm running in browser-only mode. I can handle local commands and memory, but full AI reasoning requires an AI service connection.";
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const message = input.value.trim();
  if (!message) return;
  addMessage("user", message);
  input.value = "";
  send.disabled = true;

  window.setTimeout(() => {
    addMessage("jarvis", respond(message));
    send.disabled = false;
    input.focus();
  }, 180);
});

clear.addEventListener("click", () => {
  messages.innerHTML = "";
  addMessage("jarvis", "Conversation cleared. Ready when you are.");
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

status.textContent = "BROWSER MODE · ONLINE";
status.previousElementSibling.style.background = "#69d8ff";
