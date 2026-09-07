/*
 * JARVIS STARTUP SEQUENCE
 */

const startup = document.getElementById("startup");
const startupLines = document.getElementById("startupLines");
const progressBar = document.getElementById("progressBar");
const startupPercent = document.getElementById("startupPercent");
const app = document.getElementById("app");

const bootSequence = [
  ["INITIALIZING JARVIS CORE...", "active"],
  ["POWER SYSTEMS ................. ONLINE", "success"],
  ["NEURAL PROCESSOR .............. ONLINE", "success"],
  ["MEMORY SYSTEMS ................ SYNCHRONIZED", "success"],
  ["LOCAL TOOLS ................... READY", "success"],
  ["USER INTERFACE ................ CONNECTED", "success"],
  ["SECURITY PROTOCOLS ............ ACTIVE", "success"],
  ["INTELLIGENCE SYSTEM ........... STANDBY", "success"],
  ["", ""],
  ["JARVIS CORE INITIALIZATION COMPLETE", "active"],
  ["", ""],
  ["GOOD EVENING.", "success"],
  ["I AM JARVIS.", "success"],
  ["JUST A RATHER VERY INTELLIGENT SYSTEM.", "success"],
  ["", ""],
  ["ALL SYSTEMS NOMINAL.", "active"],
  ["JARVIS IS STANDING BY.", "success"]
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runStartup() {
  // If startup HTML isn't present, simply continue normally.
  if (!startup || !startupLines || !progressBar || !startupPercent) {
    if (app) {
      app.classList.remove("hidden");
    }
    return;
  }

  for (let i = 0; i < bootSequence.length; i++) {
    const [text, type] = bootSequence[i];

    const line = document.createElement("div");
    line.className = "startup-line";

    if (type) {
      line.classList.add(type);
    }

    line.textContent = text || "\u00a0";

    startupLines.appendChild(line);

    const progress = Math.round(
      ((i + 1) / bootSequence.length) * 100
    );

    progressBar.style.width = `${progress}%`;
    startupPercent.textContent = `${progress}%`;

    await sleep(text ? 320 : 180);
  }

  await sleep(1100);

  startup.classList.add("hide");

  if (app) {
    app.classList.remove("hidden");
  }

  // Focus the existing JARVIS input if it exists.
  const input = document.getElementById("input");

  if (input) {
    input.focus();
  }
}


/*
 * SAFE EVENT LISTENER HELPER
 *
 * Prevents:
 * "Cannot read properties of null (reading 'addEventListener')"
 */

function on(element, event, handler) {
  if (!element) {
    return;
  }

  element.addEventListener(event, handler);
}


/*
 * EXISTING JARVIS CONTROLS
 *
 * These connect to your existing HTML without
 * crashing if an optional element is missing.
 */

const chatForm = document.getElementById("chatForm");
const input = document.getElementById("input");
const messages = document.getElementById("messages");
const clearButton = document.getElementById("clear");


/*
 * CLEAR CHAT
 *
 * Only attach the handler when the Clear button
 * actually exists.
 */

on(clearButton, "click", () => {
  if (!messages) {
    return;
  }

  messages.innerHTML = "";

  // Use your existing addMessage() function.
  if (typeof addMessage === "function") {
    addMessage(
      "jarvis",
      "**Conversation cleared.** Systems remain operational."
    );
  }
});


/*
 * STARTUP
 */

runStartup();

