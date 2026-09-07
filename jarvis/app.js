const startup = document.getElementById("startup");
const startupLines = document.getElementById("startupLines");
const progressBar = document.getElementById("progressBar");
const startupPercent = document.getElementById("startupPercent");
const app = document.getElementById("app");

const messages = document.getElementById("messages");
const chatForm = document.getElementById("chatForm");
const input = document.getElementById("input");
const clearButton = document.getElementById("clear");


/*
 * JARVIS STARTUP SEQUENCE
 */

const bootSequence = [
  ["INITIALIZING JARVIS CORE...", "active"],
  ["POWER SYSTEMS ................. ONLINE", "success"],
  ["NEURAL PROCESSOR .............. ONLINE", "success"],
  ["MEMORY SYSTEMS ................ SYNCHRONIZED", "success"],
  ["LOCAL TOOLS ................... READY", "success"],
  ["USER INTERFACE ............... CONNECTED", "success"],
  ["SECURITY PROTOCOLS ........... ACTIVE", "success"],
  ["INTELLIGENCE SYSTEM .......... STANDBY", "success"],
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


async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


async function runStartup() {

  for (let i = 0; i < bootSequence.length; i++) {

    const [text, type] = bootSequence[i];

    const line = document.createElement("div");

    line.className = "startup-line";

    if (type) {
      line.classList.add(type);
    }

    line.textContent = text || "\u00a0";

    startupLines.appendChild(line);

    requestAnimationFrame(() => {
      line.style.animationDelay = "0ms";
    });

    const progress =
      Math.round(((i + 1) / bootSequence.length) * 100);

    progressBar.style.width = `${progress}%`;

    startupPercent.textContent = `${progress}%`;

    await sleep(
      text === ""
        ? 180
        : 320
    );
  }


  await sleep(1100);

  startup.classList.add("hide");

  app.classList.remove("hidden");

  input.focus();
}


/*
 * SIMPLE MARKDOWN FORMATTER
 *
 * Supports:
 *
 * **bold**
 * *italic*
 * `code`
 * ```code blocks```
 * - lists
 */

function escapeHTML(text) {

  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function formatText(text) {

  let html = escapeHTML(text);


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
    /(?<!\*)\*([^*]+)\*(?!\*)/g,
    "<em>$1</em>"
  );


  // Convert line breaks
  html = html.replace(/\n/g, "<br>");


  return html;
}


/*
 * ADD MESSAGE
 */

function addMessage(sender, text) {

  const article = document.createElement("article");

  article.className =
    sender === "user"
      ? "message user"
      : "message jarvis";


  const label = document.createElement("span");

  label.className = "label";

  label.textContent =
    sender === "user"
      ? "YOU"
      : "JARVIS";


  const content = document.createElement("div");

  content.className = "message-content";

  content.innerHTML = formatText(text);


  article.appendChild(label);

  article.appendChild(content);

  messages.appendChild(article);


  messages.scrollTop = messages.scrollHeight;
}


/*
 * DEMO RESPONSE
 *
 * Replace this later with your Groq request.
 */

async function respondToUser(text) {

  await sleep(500);

  return `**Understood.**

You said:

> ${text}

JARVIS is ready to assist.`;
}


/*
 * CHAT
 */

chatForm.addEventListener("submit", async event => {

  event.preventDefault();

  const text = input.value.trim();

  if (!text) {
    return;
  }


  input.value = "";

  addMessage("user", text);


  const response = await respondToUser(text);

  addMessage("jarvis", response);
});


/*
 * CLEAR CHAT
 */

clearButton.addEventListener("click", () => {

  messages.innerHTML = "";

  addMessage(
    "jarvis",
    "**Conversation cleared.** Systems remain operational."
  );
});


/*
 * START JARVIS
 */

runStartup();

