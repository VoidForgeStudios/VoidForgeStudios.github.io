
const STORAGE_KEY = "jarvis_local_memory_v1";
const CHAT_KEY = "jarvis_local_chat_v1";
const ACCESS_KEY = "jarvis_backend_access_v1";

const BACKEND_URL =
  "https://voidforgestudios-github-io.onrender.com/api/jarvis";

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


/* =========================================================
   STARTUP
========================================================= */

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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


/* =========================================================
   STORAGE
========================================================= */

function loadJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error("Storage error:", error);
  }
}

function loadMemory() {
  return loadJson(STORAGE_KEY, {});
}

function saveMemory(memory) {
  saveJson(STORAGE_KEY, memory);
}


/* =========================================================
   ACCESS TOKEN
========================================================= */

function getAccessToken() {
  try {
    return sessionStorage.getItem(ACCESS_KEY) || "";
  } catch {
    return "";
  }
}

function setAccessToken(value) {
  try {
    sessionStorage.setItem(ACCESS_KEY, value);
  } catch {
    console.warn("Session storage unavailable.");
  }
}

function clearAccessToken() {
  try {
    sessionStorage.removeItem(ACCESS_KEY);
  } catch {
    console.warn("Could not clear access token.");
  }
}


/* =========================================================
   STATUS
========================================================= */

function setStatus(text, active = false) {
  if (status) {
    status.textContent = text;
  }

  if (statusDot) {
    statusDot.style.background = active ? "#69d8ff" : "#657180";
  }
}

function updateConnectionUI(online = Boolean(getAccessToken())) {
  if (agentStatus) {
    agentStatus.textContent = online
      ? "SERVER KEYS · READY"
      : "SERVER KEYS · OFFLINE";
  }

  if (connect) {
    connect.textContent = online
      ? "Reconnect Securely"
      : "Connect Securely";
  }

  if (disconnect) {
    disconnect.disabled = !online;
  }

  setStatus(
    online
      ? "JARVIS · SECURE NETWORK READY"
      : "BACKEND · NOT CONNECTED",
    online
  );
}


/* =========================================================
   STARTUP ANIMATION
========================================================= */

async function runStartup() {
  if (
    !startup ||
    !startupLines ||
    !progressBar ||
    !startupPercent
  ) {
    app?.classList.remove("hidden");
    input?.focus();
    return;
  }

  startupLines.innerHTML = "";

  for (let i = 0; i < bootSequence.length; i++) {
    const [text, type] = bootSequence[i];

    const line = document.createElement("div");
    line.className = `startup-line ${type || ""}`;
    line.textContent = text;

    startupLines.appendChild(line);

    const progress = Math.round(
      ((i + 1) / bootSequence.length) * 100
    );

    progressBar.style.width = `${progress}%`;
    startupPercent.textContent = `${progress}%`;

    await sleep(240);
  }

  await sleep(700);

  startup.classList.add("hide");
  app?.classList.remove("hidden");

  input?.focus();
}


/* =========================================================
   SECURITY / FORMATTING
========================================================= */

function escapeHTML(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatText(text) {
  let html = escapeHTML(String(text));

  // Code blocks
  html = html.replace(
    /```([\s\S]*?)```/g,
    "<pre><code>$1</code></pre>"
  );

  // Inline code
  html = html.replace(
    /`([^`]+)`/g,
    "<code>$1</code>"
  );

  // Bold
  html = html.replace(
    /\*\*(.+?)\*\*/g,
    "<strong>$1</strong>"
  );

  // Italic
  html = html.replace(
    /(?<!\*)\*([^*\n]+)\*(?!\*)/g,
    "<em>$1</em>"
  );

  const lines = html.split("\n");

  let result = "";
  let inList = false;

  for (const line of lines) {
    const match = line.match(/^\s*[-•]\s+(.+)$/);

    if (match) {
      if (!inList) {
        result += "<ul>";
        inList = true;
      }

      result += `<li>${match[1]}</li>`;
    } else {
      if (inList) {
        result += "</ul>";
        inList = false;
      }

      if (line.trim()) {
        result += `<p>${line}</p>`;
      }
    }
  }

  if (inList) {
    result += "</ul>";
  }

  return result;
}


/* =========================================================
   CHAT
========================================================= */

function saveChat() {
  if (!messages) return;

  const history = Array.from(
    messages.querySelectorAll(".message")
  ).map(message => ({
    role: message.classList.contains("user")
      ? "user"
      : "jarvis",

    text:
      message.querySelector(".message-content")
        ?.textContent || ""
  }));

  saveJson(CHAT_KEY, history.slice(-100));
}

function addMessage(role, text, persist = true) {
  if (!messages) return;

  const article = document.createElement("article");

  article.className = `message ${role}`;

  const label = document.createElement("span");
  label.className = "label";
  label.textContent = role === "user"
    ? "YOU"
    : "JARVIS";

  const content = document.createElement("div");
  content.className = "message-content";
  content.innerHTML = formatText(String(text));

  article.append(label, content);
  messages.appendChild(article);

  messages.scrollTop = messages.scrollHeight;

  if (persist) {
    saveChat();
  }
}

function restoreChat() {
  if (!messages) return;

  const history = loadJson(CHAT_KEY, []);

  if (!Array.isArray(history) || !history.length) {
    return;
  }

  messages.innerHTML = "";

  history
    .slice(-100)
    .forEach(item => {
      addMessage(
        item.role === "user" ? "user" : "jarvis",
        String(item.text),
        false
      );
    });

  messages.scrollTop = messages.scrollHeight;
}


/* =========================================================
   LOCAL JARVIS COMMANDS
========================================================= */

function localResponse(raw) {
  const text = String(raw).trim();
  const lower = text.toLowerCase();

  const memory = loadMemory();


  /* HELP */

  if (
    lower === "help" ||
    lower === "commands"
  ) {
    return `**JARVIS commands**

• help
• time
• date
• system info
• calculate <expression>
• remember <key> = <value>
• forget <key>
• memory
• clear memory
• clear

Normal questions are routed through the secure multi-agent backend.`;
  }


  /* TIME */

  if (
    lower === "time" ||
    lower === "what time is it"
  ) {
    return `The local time is **${
      new Intl.DateTimeFormat(undefined, {
        timeStyle: "medium"
      }).format(new Date())
    }**.`;
  }


  /* DATE */

  if (lower === "date") {
    return `Today is **${
      new Intl.DateTimeFormat(undefined, {
        dateStyle: "full"
      }).format(new Date())
    }**.`;
  }


  /* SYSTEM INFO */

  if (
    lower === "system info" ||
    lower === "system information"
  ) {
    return [
      `Browser: ${
        navigator.userAgentData?.brands
          ?.map(x => `${x.brand} ${x.version}`)
          .join(", ") ||
        navigator.appName ||
        "Unknown"
      }`,

      `Platform: ${
        navigator.userAgentData?.platform ||
        navigator.platform ||
        "Unknown"
      }`,

      `Language: ${
        navigator.language || "Unknown"
      }`,

      `Online: ${
        navigator.onLine ? "Yes" : "No"
      }`,

      `CPU cores exposed: ${
        navigator.hardwareConcurrency || "Unknown"
      }`,

      `Screen: ${
        screen.width
      } × ${
        screen.height
      }`,

      `Viewport: ${
        window.innerWidth
      } × ${
        window.innerHeight
      }`
    ].join("\n");
  }


  /* MEMORY */

  if (
    lower === "memory" ||
    lower === "what do you remember" ||
    lower === "what do you remember?"
  ) {
    const entries = Object.entries(memory);

    if (!entries.length) {
      return "Memory is empty. Tell me: **remember <key> = <value>**.";
    }

    return entries
      .map(([key, value]) =>
        `• **${key}:** ${value}`
      )
      .join("\n");
  }


  /* CLEAR MEMORY */

  if (lower === "clear memory") {
    localStorage.removeItem(STORAGE_KEY);

    return "**All local JARVIS memories have been cleared.**";
  }


  /* REMEMBER */

  const remember = text.match(
    /^remember\s+(.+?)\s*=\s*(.+)$/i
  );

  if (remember) {
    const key = remember[1].trim();
    const value = remember[2].trim();

    if (
      !key ||
      key.length > 100 ||
      value.length > 1000
    ) {
      return "That memory is too large to save.";
    }

    memory[key] = value;

    saveMemory(memory);

    return `**Remembered:** ${key} = ${value}`;
  }


  /* FORGET */

  const forget = text.match(
    /^forget\s+(.+)$/i
  );

  if (forget) {
    const key = forget[1].trim();

    if (!(key in memory)) {
      return `I don't have a memory called “${key}”.`;
    }

    delete memory[key];

    saveMemory(memory);

    return `**Forgotten:** ${key}.`;
  }


  /* CALCULATOR */

  const calc = text.match(
    /^(?:calculate|calc)\s+(.+)$/i
  );

  if (calc) {
    const cleaned = calc[1]
      .replace(/×/g, "*")
      .replace(/÷/g, "/")
      .trim();

    if (
      !cleaned ||
      cleaned.length > 100 ||
      !/^[0-9+\-*/%().\s]+$/.test(cleaned)
    ) {
      return "I couldn't safely evaluate that expression.";
    }

    try {
      const value = Function(
        `"use strict"; return (${cleaned})`
      )();

      if (!Number.isFinite(value)) {
        throw new Error("Invalid result");
      }

      return `**Result:** ${
        Number.isInteger(value)
          ? value
          : Number(value.toFixed(10))
      }`;

    } catch {
      return "I couldn't safely evaluate that expression.";
    }
  }


  return null;
}


/* =========================================================
   BACKEND CONVERSATION
========================================================= */

function conversationForBackend() {
  if (!messages) return [];

  return Array.from(
    messages.querySelectorAll(".message")
  )
    .slice(-20)
    .map(message => ({
      role: message.classList.contains("user")
        ? "user"
        : "assistant",

      content:
        message.querySelector(".message-content")
          ?.textContent || ""
    }));
}


/* =========================================================
   BACKEND REQUEST
========================================================= */

async function askBackend(userText) {
  const token = getAccessToken();

  if (!token) {
    throw new Error(
      "Connect JARVIS securely first."
    );
  }

  const response = await fetch(BACKEND_URL, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },

    body: JSON.stringify({
      message: userText,

      messages: conversationForBackend(),

      memory:
        Object.entries(loadMemory())
          .slice(0, 30)
          .map(([key, value]) =>
            `${key}: ${value}`
          )
          .join("\n") ||
        "No saved memories."
    })
  });


  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }


  if (!response.ok) {
    throw new Error(
      data?.error ||
      `Backend request failed (${response.status}).`
    );
  }


  if (!data.answer) {
    throw new Error(
      "Backend returned no answer."
    );
  }


  return data;
}


/* =========================================================
   CONNECT
========================================================= */

connect?.addEventListener("click", async () => {
  const typedToken =
    accessToken?.value.trim() || "";

  const existingToken =
    getAccessToken();

  /*
     If the field contains the masked token,
     don't overwrite the real token.
  */

  const token =
    typedToken &&
    !typedToken.includes("••")
      ? typedToken
      : existingToken;


  if (!token) {
    setStatus(
      "ACCESS CODE REQUIRED",
      false
    );

    accessToken?.focus();

    return;
  }


  setAccessToken(token);

  setStatus(
    "JARVIS · VERIFYING BACKEND",
    true
  );


  try {
    const result = await askBackend(
      "Return exactly: SECURE CONNECTION VERIFIED."
    );


    updateConnectionUI(true);

    addMessage(
      "jarvis",
      `**Secure network online.** ${result.answer}`
    );

  } catch (error) {

    clearAccessToken();

    if (accessToken) {
      accessToken.value = "";
    }

    updateConnectionUI(false);

    setStatus(
      "BACKEND · CONNECTION FAILED",
      false
    );

    addMessage(
      "jarvis",
      `**Connection failed:** ${error.message}`
    );
  }
});


/* =========================================================
   DISCONNECT
========================================================= */

disconnect?.addEventListener("click", () => {
  clearAccessToken();

  if (accessToken) {
    accessToken.value = "";
  }

  updateConnectionUI(false);

  addMessage(
    "jarvis",
    "**Secure connection closed.**",
    true
  );
});


/* =========================================================
   CLEAR CHAT
========================================================= */

clear?.addEventListener("click", () => {
  localStorage.removeItem(CHAT_KEY);

  if (messages) {
    messages.innerHTML = "";
  }

  addMessage(
    "jarvis",
    "**Conversation cleared.** Local memories remain intact.",
    false
  );
});


/* =========================================================
   SEND MESSAGE
========================================================= */

form?.addEventListener("submit", async event => {
  event.preventDefault();


  const text =
    input?.value.trim();


  if (
    !text ||
    send?.disabled
  ) {
    return;
  }


  input.value = "";


  /* Check local commands first */

  const local =
    localResponse(text);


  addMessage(
    "user",
    text
  );


  if (local !== null) {
    addMessage(
      "jarvis",
      local
    );

    return;
  }


  /* Backend */

  send.disabled = true;
  input.disabled = true;


  setStatus(
    "JARVIS · WORKERS + MASTER PROCESSING",
    true
  );


  try {

    const result =
      await askBackend(text);


    addMessage(
      "jarvis",
      result.answer
    );


    if (agentStatus) {

      const workerCount =
        Number(result.workerCount);


      agentStatus.textContent =
        Number.isFinite(workerCount)
          ? `${workerCount} WORKER${
              workerCount === 1 ? "" : "S"
            } · MASTER ONLINE`
          : "MASTER ONLINE";
    }


    setStatus(
      "JARVIS · SECURE NETWORK READY",
      true
    );


  } catch (error) {

    addMessage(
      "jarvis",
      `**Backend error:** ${error.message}`
    );


    if (
      /access denied|unauthorized|401|403/i
        .test(error.message)
    ) {

      clearAccessToken();

      if (accessToken) {
        accessToken.value = "";
      }

      updateConnectionUI(false);

    } else {

      setStatus(
        "JARVIS · BACKEND ERROR",
        false
      );
    }


  } finally {

    send.disabled = false;
    input.disabled = false;

    input.focus();
  }
});


/* =========================================================
   ENTER TO SEND
========================================================= */

input?.addEventListener(
  "keydown",
  event => {

    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {

      event.preventDefault();

      form?.requestSubmit();
    }
  }
);


/* =========================================================
   INITIALIZE
========================================================= */

restoreChat();


if (accessToken) {
  accessToken.value =
    getAccessToken()
      ? "••••••••••••••••"
      : "";
}


updateConnectionUI(
  Boolean(getAccessToken())
);


runStartup();
