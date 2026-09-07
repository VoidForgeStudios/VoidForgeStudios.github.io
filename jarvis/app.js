const STORAGE_KEY = "jarvis_local_memory_v1";
const CHAT_KEY = "jarvis_local_chat_v1";
const ACCESS_KEY = "jarvis_backend_access_v1";
const BACKEND_URL = "https://REPLACE-WITH-YOUR-VERCEL-APP.vercel.app/api/jarvis";

const messages = document.querySelector("#messages");
const form = document.querySelector("#chatForm");
const input = document.querySelector("#input");
const send = document.querySelector("#send");
const clear = document.querySelector("#clear");
const status = document.querySelector("#status");
const statusDot = status?.previousElementSibling;
const connect = document.querySelector("#connect");
const disconnect = document.querySelector("#disconnect");
const accessToken = document.querySelector("#accessToken");
const agentStatus = document.querySelector("#agentStatus");
const startup = document.querySelector("#startup");
const startupLines = document.querySelector("#startupLines");
const progressBar = document.querySelector("#progressBar");
const startupPercent = document.querySelector("#startupPercent");
const app = document.querySelector("#app");

const bootSequence = [
  ["INITIALIZING JARVIS CORE...", "active"],
  ["POWER SYSTEMS ................. ONLINE", "success"],
  ["NEURAL PROCESSOR .............. ONLINE", "success"],
  ["MEMORY SYSTEMS ................ SYNCHRONIZED", "success"],
  ["LOCAL TOOLS ................... READY", "success"],
  ["USER INTERFACE ................ CONNECTED", "success"],
  ["SECURITY PROTOCOLS ............ ACTIVE", "success"],
  ["INTELLIGENCE NETWORK .......... STANDBY", "success"],
  ["JARVIS CORE INITIALIZATION COMPLETE", "active"],
  ["GOOD EVENING.", "success"],
  ["SECURE AI NETWORK READY.", "success"],
  ["JARVIS IS STANDING BY.", "active"]
];

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function loadJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function saveJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function loadMemory() { return loadJson(STORAGE_KEY, {}); }
function saveMemory(memory) { saveJson(STORAGE_KEY, memory); }
function getAccessToken() { try { return sessionStorage.getItem(ACCESS_KEY) || ""; } catch { return ""; } }
function setAccessToken(value) { try { sessionStorage.setItem(ACCESS_KEY, value); } catch {} }
function clearAccessToken() { try { sessionStorage.removeItem(ACCESS_KEY); } catch {} }

function setStatus(text, active = false) {
  if (status) status.textContent = text;
  if (statusDot) statusDot.style.background = active ? "#69d8ff" : "#657180";
}

function updateConnectionUI(online = Boolean(getAccessToken())) {
  if (agentStatus) agentStatus.textContent = online ? "SERVER KEYS · READY" : "SERVER KEYS · OFFLINE";
  if (connect) connect.textContent = online ? "Reconnect Securely" : "Connect Securely";
  if (disconnect) disconnect.disabled = !online;
  setStatus(online ? "JARVIS · SECURE NETWORK READY" : "BACKEND · NOT CONNECTED", online);
}

async function runStartup() {
  if (!startup || !startupLines || !progressBar || !startupPercent) { app?.classList.remove("hidden"); return; }
  for (let i = 0; i < bootSequence.length; i++) {
    const [text, type] = bootSequence[i];
    const line = document.createElement("div");
    line.className = `startup-line ${type || ""}`;
    line.textContent = text;
    startupLines.appendChild(line);
    const progress = Math.round(((i + 1) / bootSequence.length) * 100);
    progressBar.style.width = `${progress}%`;
    startupPercent.textContent = `${progress}%`;
    await sleep(240);
  }
  await sleep(700);
  startup.classList.add("hide");
  app?.classList.remove("hidden");
  input?.focus();
}

function escapeHTML(text) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function formatText(text) {
  let html = escapeHTML(text);
  html = html.replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
  const lines = html.split("\n");
  let result = "", inList = false;
  for (const line of lines) {
    const match = line.match(/^\s*[-•]\s+(.+)$/);
    if (match) { if (!inList) { result += "<ul>"; inList = true; } result += `<li>${match[1]}</li>`; }
    else { if (inList) { result += "</ul>"; inList = false; } result += line ? `<p>${line}</p>` : ""; }
  }
  if (inList) result += "</ul>";
  return result;
}

function addMessage(role, text, persist = true) {
  const article = document.createElement("article");
  article.className = `message ${role}`;
  const label = document.createElement("span");
  label.className = "label";
  label.textContent = role === "user" ? "YOU" : "JARVIS";
  const content = document.createElement("div");
  content.className = "message-content";
  content.innerHTML = formatText(String(text));
  article.append(label, content);
  messages.appendChild(article);
  messages.scrollTop = messages.scrollHeight;
  if (persist) saveJson(CHAT_KEY, Array.from(messages.querySelectorAll(".message")).map(m => ({ role: m.classList.contains("user") ? "user" : "jarvis", text: m.querySelector(".message-content")?.textContent || "" })));
}

function restoreChat() {
  const history = loadJson(CHAT_KEY, []);
  if (!Array.isArray(history) || !history.length) return;
  messages.innerHTML = "";
  history.slice(-100).forEach(item => addMessage(item.role === "user" ? "user" : "jarvis", String(item.text), false));
}

function localResponse(raw) {
  const text = raw.trim();
  const lower = text.toLowerCase();
  const memory = loadMemory();
  if (lower === "help" || lower === "commands") return "**JARVIS commands**\n\n• help\n• time\n• date\n• system info\n• calculate <expression>\n• remember <key> = <value>\n• forget <key>\n• memory\n• clear memory\n• clear\n\nNormal questions are routed through the secure multi-agent backend.";
  if (lower === "time" || lower === "what time is it") return `The local time is **${new Intl.DateTimeFormat(undefined, { timeStyle: "medium" }).format(new Date())}**.`;
  if (lower === "date") return `Today is **${new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(new Date())}**.`;
  if (lower === "system info" || lower === "system information") return [`Browser: ${navigator.userAgentData?.brands?.map(x => `${x.brand} ${x.version}`).join(", ") || navigator.appName}`, `Platform: ${navigator.userAgentData?.platform || navigator.platform || "Unknown"}`, `Language: ${navigator.language}`, `Online: ${navigator.onLine ? "Yes" : "No"}`, `CPU cores exposed: ${navigator.hardwareConcurrency || "Unknown"}`, `Screen: ${screen.width} × ${screen.height}`, `Viewport: ${window.innerWidth} × ${window.innerHeight}`].join("\n");
  if (lower === "memory" || lower === "what do you remember" || lower === "what do you remember?") {
    const entries = Object.entries(memory);
    return entries.length ? entries.map(([key, value]) => `• **${key}:** ${value}`).join("\n") : "Memory is empty. Tell me: **remember <key> = <value>**.";
  }
  if (lower === "clear memory") { localStorage.removeItem(STORAGE_KEY); return "**All local JARVIS memories have been cleared.**"; }
  const remember = text.match(/^remember\s+(.+?)\s*=\s*(.+)$/i);
  if (remember) { const key = remember[1].trim(), value = remember[2].trim(); if (!key || key.length > 100 || value.length > 1000) return "That memory is too large to save."; memory[key] = value; saveMemory(memory); return `**Remembered:** ${key} = ${value}`; }
  const forget = text.match(/^forget\s+(.+)$/i);
  if (forget) { const key = forget[1].trim(); if (!(key in memory)) return `I don't have a memory called “${key}”.`; delete memory[key]; saveMemory(memory); return `**Forgotten:** ${key}.`; }
  const calc = text.match(/^(?:calculate|calc)\s+(.+)$/i);
  if (calc) {
    const cleaned = calc[1].replace(/×/g, "*").replace(/÷/g, "/").trim();
    if (!cleaned || cleaned.length > 100 || !/^[0-9+\-*/%().\s]+$/.test(cleaned)) return "I couldn't safely evaluate that expression.";
    try { const value = Function(`"use strict"; return (${cleaned})`)(); if (!Number.isFinite(value)) throw new Error(); return `**Result:** ${Number.isInteger(value) ? value : Number(value.toFixed(10))}`; } catch { return "I couldn't safely evaluate that expression."; }
  }
  return null;
}

function conversationForBackend() {
  return Array.from(messages.querySelectorAll(".message")).slice(-20).map(message => ({ role: message.classList.contains("user") ? "user" : "assistant", content: message.querySelector(".message-content")?.textContent || "" }));
}

async function askBackend(userText) {
  const token = getAccessToken();
  if (!token) throw new Error("Connect JARVIS securely first.");
  const response = await fetch(BACKEND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message: userText, messages: conversationForBackend(), memory: Object.entries(loadMemory()).slice(0, 30).map(([k, v]) => `${k}: ${v}`).join("\n") || "No saved memories." })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `Backend request failed (${response.status}).`);
  return data;
}

connect?.addEventListener("click", async () => {
  const token = accessToken?.value.trim() || getAccessToken();
  if (!token) { setStatus("ACCESS CODE REQUIRED", false); accessToken?.focus(); return; }
  setAccessToken(token);
  setStatus("JARVIS · VERIFYING BACKEND", true);
  try {
    const result = await askBackend("Return exactly: SECURE CONNECTION VERIFIED.");
    updateConnectionUI(true);
    addMessage("jarvis", `**Secure network online.** ${result.answer}`);
  } catch (error) {
    clearAccessToken();
    updateConnectionUI(false);
    setStatus("BACKEND · CONNECTION FAILED", false);
    addMessage("jarvis", `**Connection failed:** ${error.message}`);
  }
});

disconnect?.addEventListener("click", () => { clearAccessToken(); if (accessToken) accessToken.value = ""; updateConnectionUI(false); });
clear?.addEventListener("click", () => { localStorage.removeItem(CHAT_KEY); messages.innerHTML = ""; addMessage("jarvis", "**Conversation cleared.** Local memories remain intact.", false); });

form?.addEventListener("submit", async event => {
  event.preventDefault();
  const text = input?.value.trim();
  if (!text || send?.disabled) return;
  input.value = "";
  const local = localResponse(text);
  addMessage("user", text);
  if (local) { addMessage("jarvis", local); return; }
  send.disabled = true;
  input.disabled = true;
  setStatus("JARVIS · WORKERS + MASTER PROCESSING", true);
  try {
    const result = await askBackend(text);
    addMessage("jarvis", result.answer);
    if (agentStatus) agentStatus.textContent = `${result.workerCount} WORKER${result.workerCount === 1 ? "" : "S"} · MASTER ONLINE`;
    setStatus("JARVIS · SECURE NETWORK READY", true);
  } catch (error) {
    addMessage("jarvis", `**Backend error:** ${error.message}`);
    if (/access denied|unauthorized|401/i.test(error.message)) { clearAccessToken(); updateConnectionUI(false); }
    else setStatus("JARVIS · BACKEND ERROR", false);
  } finally { send.disabled = false; input.disabled = false; input.focus(); }
});

input?.addEventListener("keydown", event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); form?.requestSubmit(); } });
restoreChat();
if (accessToken) accessToken.value = getAccessToken() ? "••••••••••••••••" : "";
updateConnectionUI(Boolean(getAccessToken()));
runStartup();
