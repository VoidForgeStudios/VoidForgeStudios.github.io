const STORAGE_KEY = "jarvis_local_memory_v1";
const CHAT_KEY = "jarvis_local_chat_v1";
const NETWORK_KEY = "jarvis_groq_network_v1";
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODELS_ENDPOINT = "https://api.groq.com/openai/v1/models";
const PREFERRED_GROQ_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "llama-3.1-8b-instant"];

const messages = document.querySelector("#messages");
const form = document.querySelector("#chatForm");
const input = document.querySelector("#input");
const send = document.querySelector("#send");
const clear = document.querySelector("#clear");
const status = document.querySelector("#status");
const statusDot = status?.previousElementSibling;
const connect = document.querySelector("#connect");
const disconnect = document.querySelector("#disconnect");
const agentStatus = document.querySelector("#agentStatus");
const startup = document.querySelector("#startup");
const startupLines = document.querySelector("#startupLines");
const progressBar = document.querySelector("#progressBar");
const startupPercent = document.querySelector("#startupPercent");
const app = document.querySelector("#app");

const workerInputs = [1, 2, 3].map(n => document.querySelector(`#workerKey${n}`));
const masterInput = document.querySelector("#masterKey");
let activeModels = new Map();

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
  ["MULTI-AGENT NETWORK READY.", "success"],
  ["JARVIS IS STANDING BY.", "active"]
];

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function runStartup() {
  if (!startup || !startupLines || !progressBar || !startupPercent) {
    app?.classList.remove("hidden");
    return;
  }
  for (let i = 0; i < bootSequence.length; i++) {
    const [text, type] = bootSequence[i];
    const line = document.createElement("div");
    line.className = `startup-line ${type || ""}`;
    line.textContent = text || "\u00a0";
    startupLines.appendChild(line);
    const progress = Math.round(((i + 1) / bootSequence.length) * 100);
    progressBar.style.width = `${progress}%`;
    startupPercent.textContent = `${progress}%`;
    await sleep(text ? 260 : 140);
  }
  await sleep(900);
  startup.classList.add("hide");
  app?.classList.remove("hidden");
  input?.focus();
}

function loadJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function saveJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function loadMemory() { return loadJson(STORAGE_KEY, {}); }
function saveMemory(memory) { saveJson(STORAGE_KEY, memory); }

function loadNetwork() {
  try { return JSON.parse(sessionStorage.getItem(NETWORK_KEY)) || { workers: ["", "", ""], master: "" }; }
  catch { return { workers: ["", "", ""], master: "" }; }
}
function saveNetwork(network) {
  try { sessionStorage.setItem(NETWORK_KEY, JSON.stringify(network)); } catch { /* session storage unavailable */ }
}
function clearNetwork() {
  try { sessionStorage.removeItem(NETWORK_KEY); } catch { /* ignore */ }
  activeModels.clear();
}
function getNetwork() {
  const saved = loadNetwork();
  return {
    workers: Array.isArray(saved.workers) ? saved.workers.slice(0, 3).concat(["", "", ""]).slice(0, 3) : ["", "", ""],
    master: typeof saved.master === "string" ? saved.master : ""
  };
}

function setStatus(text, active = false) {
  if (status) status.textContent = text;
  if (statusDot) statusDot.style.background = active ? "#69d8ff" : "#657180";
}

function updateNetworkUI() {
  const network = getNetwork();
  const workers = network.workers.filter(Boolean).length;
  const master = Boolean(network.master);
  if (agentStatus) agentStatus.textContent = `${workers} WORKER${workers === 1 ? "" : "S"} · MASTER ${master ? "ONLINE" : "OFFLINE"}`;
  if (connect) connect.textContent = master || workers ? "Update Network" : "Connect Network";
  if (disconnect) disconnect.disabled = !(master || workers);
  setStatus(master && workers ? "JARVIS · NETWORK READY" : workers ? "JARVIS · WORKERS READY" : "GROQ · NOT CONNECTED", Boolean(master || workers));
}

function restoreNetworkInputs() {
  const network = getNetwork();
  workerInputs.forEach((inputEl, i) => { if (inputEl) inputEl.value = network.workers[i] ? "••••••••••••••••" : ""; });
  if (masterInput) masterInput.value = network.master ? "••••••••••••••••" : "";
}

function addMessage(role, text, persist = true, labelOverride = null) {
  const article = document.createElement("article");
  article.className = `message ${role}`;
  const label = document.createElement("span");
  label.className = "label";
  label.textContent = labelOverride || (role === "user" ? "YOU" : "JARVIS");
  const content = document.createElement("div");
  content.className = "message-content";
  content.innerHTML = formatText(String(text));
  article.append(label, content);
  messages.appendChild(article);
  messages.scrollTop = messages.scrollHeight;
  if (persist) saveJson(CHAT_KEY, Array.from(messages.querySelectorAll(".message")).map(m => ({ role: m.classList.contains("user") ? "user" : "jarvis", text: m.querySelector(".message-content")?.textContent || "" })));
  return content;
}

function restoreChat() {
  const history = loadJson(CHAT_KEY, []);
  if (!Array.isArray(history) || !history.length) return;
  messages.innerHTML = "";
  history.slice(-100).forEach(item => addMessage(item.role === "user" ? "user" : "jarvis", String(item.text), false));
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
  let result = "";
  let inList = false;
  for (const line of lines) {
    const match = line.match(/^\s*[-•]\s+(.+)$/);
    if (match) {
      if (!inList) { result += "<ul>"; inList = true; }
      result += `<li>${match[1]}</li>`;
    } else {
      if (inList) { result += "</ul>"; inList = false; }
      result += line ? `<p>${line}</p>` : "";
    }
  }
  if (inList) result += "</ul>";
  return result;
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
  return [
    `Browser: ${navigator.userAgentData?.brands?.map(x => `${x.brand} ${x.version}`).join(", ") || navigator.appName}`,
    `Platform: ${navigator.userAgentData?.platform || navigator.platform || "Unknown"}`,
    `Language: ${navigator.language}`,
    `Online: ${navigator.onLine ? "Yes" : "No"}`,
    `CPU cores exposed: ${navigator.hardwareConcurrency || "Unknown"}`,
    `Memory exposed: ${navigator.deviceMemory ? `${navigator.deviceMemory} GB` : "Not exposed"}`,
    `Screen: ${screen.width} × ${screen.height}`,
    `Viewport: ${window.innerWidth} × ${window.innerHeight}`
  ].join("\n");
}

function localResponse(raw) {
  const text = raw.trim();
  const lower = text.toLowerCase();
  const memory = loadMemory();
  if (lower === "help" || lower === "commands") return "**JARVIS commands**\n\n• help\n• time\n• date\n• system info\n• calculate <expression>\n• remember <key> = <value>\n• forget <key>\n• memory\n• clear memory\n• clear\n\nNormal questions are routed through the worker agents and Master JARVIS.";
  if (lower === "time" || lower === "what time is it") return `The local time is **${new Intl.DateTimeFormat(undefined, { timeStyle: "medium" }).format(new Date())}**.`;
  if (lower === "date") return `Today is **${new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(new Date())}**.`;
  if (lower === "system info" || lower === "system information") return systemInfo();
  if (lower === "memory" || lower === "what do you remember" || lower === "what do you remember?") {
    const entries = Object.entries(memory);
    return entries.length ? entries.map(([key, value]) => `• **${key}:** ${value}`).join("\n") : "Memory is empty. Tell me: **remember <key> = <value>**.";
  }
  if (lower === "clear memory") { localStorage.removeItem(STORAGE_KEY); return "**All local JARVIS memories have been cleared.**"; }
  const remember = text.match(/^remember\s+(.+?)\s*=\s*(.+)$/i);
  if (remember) {
    const key = remember[1].trim(), value = remember[2].trim();
    if (!key || key.length > 100 || value.length > 1000) return "That memory is too large to save.";
    memory[key] = value; saveMemory(memory); return `**Remembered:** ${key} = ${value}`;
  }
  const forget = text.match(/^forget\s+(.+)$/i);
  if (forget) {
    const key = forget[1].trim();
    if (!(key in memory)) return `I don't have a memory called “${key}”.`;
    delete memory[key]; saveMemory(memory); return `**Forgotten:** ${key}.`;
  }
  const calc = text.match(/^(?:calculate|calc)\s+(.+)$/i);
  if (calc) { const result = calculate(calc[1]); return result === null ? "I couldn't safely evaluate that expression." : `**Result:** ${result}`; }
  return null;
}

function conversationForAI() {
  return Array.from(messages.querySelectorAll(".message")).slice(-20).map(message => ({
    role: message.classList.contains("user") ? "user" : "assistant",
    content: message.querySelector(".message-content")?.textContent || ""
  }));
}

async function getAvailableModel(apiKey, cacheId) {
  if (activeModels.has(cacheId)) return activeModels.get(cacheId);
  const response = await fetch(GROQ_MODELS_ENDPOINT, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!response.ok) {
    let detail = "Could not check the Groq model list.";
    try { const error = await response.json(); detail = error?.error?.message || detail; } catch {}
    throw new Error(`Groq model check failed (${response.status}): ${detail}`);
  }
  const data = await response.json();
  const available = new Set((data?.data || []).map(model => model?.id).filter(Boolean));
  const model = PREFERRED_GROQ_MODELS.find(id => available.has(id));
  if (!model) throw new Error(`No compatible Groq chat model is available for this key.`);
  activeModels.set(cacheId, model);
  return model;
}

async function askAgent(apiKey, cacheId, userText, role) {
  const model = await getAvailableModel(apiKey, cacheId);
  const memoryEntries = Object.entries(loadMemory()).slice(0, 30);
  const memoryText = memoryEntries.length ? memoryEntries.map(([key, value]) => `${key}: ${value}`).join("\n") : "No saved memories.";
  const system = role === "master"
    ? "You are MASTER JARVIS. Synthesize the worker reports into one accurate, concise answer for the user. Do not mention internal chain-of-thought. Clearly flag uncertainty or conflicting reports. Use subtle British phrasing when natural. Never claim an action was performed unless the available interface actually performed it."
    : `You are JARVIS WORKER ${role}. Provide an independent, useful analysis of the user's request for Master JARVIS. Be concise, factual, and flag uncertainty. Do not discuss hidden reasoning or chain-of-thought.`;
  const response = await fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, temperature: role === "master" ? 0.35 : 0.55, max_completion_tokens: role === "master" ? 768 : 512, messages: [
      { role: "system", content: `${system}\n\nSaved local memories:\n${memoryText}` },
      ...conversationForAI(),
      { role: "user", content: userText }
    ] })
  });
  if (!response.ok) {
    let detail = "Groq request failed.";
    try { const error = await response.json(); detail = error?.error?.message || detail; } catch {}
    throw new Error(`Groq returned ${response.status} ${response.statusText || ""}: ${detail}`.trim());
  }
  const data = await response.json();
  return data?.choices?.[0]?.message?.content?.trim() || "No response was returned.";
}

async function askNetwork(userText) {
  const network = getNetwork();
  const workers = network.workers.map((key, i) => key ? { key, id: `worker-${i + 1}`, role: `WORKER ${i + 1}` } : null).filter(Boolean);
  if (!workers.length) throw new Error("No worker Groq keys are connected.");
  if (!network.master) throw new Error("Master JARVIS has no Groq key. Add a master key to synthesize the worker responses.");

  setStatus(`JARVIS · ${workers.length} WORKERS THINKING`, true);
  const results = await Promise.allSettled(workers.map(worker => askAgent(worker.key, worker.id, userText, worker.role)));
  const reports = results.map((result, i) => result.status === "fulfilled"
    ? `WORKER ${i + 1} REPORT:\n${result.value}`
    : `WORKER ${i + 1} FAILED:\n${result.reason instanceof Error ? result.reason.message : "Unknown worker error."}`
  ).join("\n\n---\n\n");
  const successful = results.filter(result => result.status === "fulfilled").length;
  if (!successful) throw new Error("All worker agents failed to return a response.");

  setStatus("JARVIS · MASTER SYNTHESIZING", true);
  const masterPrompt = `User request:\n${userText}\n\nIndependent worker reports:\n${reports}\n\nProduce the final answer. Resolve obvious conflicts, avoid repeating the reports verbatim, and answer the user directly.`;
  const finalAnswer = await askAgent(network.master, "master", masterPrompt, "master");
  return finalAnswer;
}

if (connect) connect.addEventListener("click", () => {
  const current = getNetwork();
  const workers = workerInputs.map((el, i) => {
    const value = el?.value.trim() || "";
    return value.startsWith("••") ? current.workers[i] : value;
  });
  const masterValue = masterInput?.value.trim() || "";
  const master = masterValue.startsWith("••") ? current.master : masterValue;
  saveNetwork({ workers, master });
  activeModels.clear();
  restoreNetworkInputs();
  updateNetworkUI();
});

if (disconnect) disconnect.addEventListener("click", () => {
  clearNetwork();
  workerInputs.forEach(el => { if (el) el.value = ""; });
  if (masterInput) masterInput.value = "";
  updateNetworkUI();
});

if (form) form.addEventListener("submit", async event => {
  event.preventDefault();
  const userText = input?.value.trim();
  if (!userText) return;
  addMessage("user", userText);
  input.value = "";
  if (send) send.disabled = true;
  try {
    const local = localResponse(userText);
    if (local !== null) {
      addMessage("jarvis", local);
    } else {
      const reply = await askNetwork(userText);
      addMessage("jarvis", reply);
    }
    updateNetworkUI();
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown JARVIS network error.";
    addMessage("jarvis", `**Network error:** ${reason}`);
    updateNetworkUI();
  } finally {
    if (send) send.disabled = false;
    input?.focus();
  }
});

if (clear) clear.addEventListener("click", () => {
  messages.innerHTML = "";
  localStorage.removeItem(CHAT_KEY);
  addMessage("jarvis", "**Conversation cleared.** Local memories remain intact.");
});

if (input) input.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form?.requestSubmit();
  }
});

restoreChat();
restoreNetworkInputs();
updateNetworkUI();
runStartup();
