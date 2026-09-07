const API_BASE = window.JARVIS_API_BASE || "";
const messages = document.querySelector("#messages");
const form = document.querySelector("#chatForm");
const input = document.querySelector("#input");
const send = document.querySelector("#send");
const status = document.querySelector("#status");
const clear = document.querySelector("#clear");
const sessionId = "web-" + (crypto.randomUUID ? crypto.randomUUID() : Date.now());

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

async function checkHealth() {
  try {
    const response = await fetch(`${API_BASE}/health`);
    if (!response.ok) throw new Error();
    const data = await response.json();
    status.textContent = `${data.provider.toUpperCase()} · ${data.mode.toUpperCase()}`;
    status.previousElementSibling.style.background = "#69d8ff";
  } catch {
    status.textContent = "WEB UI · API NOT CONNECTED";
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = input.value.trim();
  if (!message) return;
  addMessage("user", message);
  input.value = "";
  send.disabled = true;
  try {
    const response = await fetch(`${API_BASE}/api/text/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, message })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Request failed");
    addMessage("jarvis", data.response);
  } catch (error) {
    addMessage("jarvis", `Connection unavailable. ${error.message}`);
  } finally {
    send.disabled = false;
    input.focus();
  }
});

clear.addEventListener("click", async () => {
  try { await fetch(`${API_BASE}/api/text/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" }); } catch {}
  messages.innerHTML = "";
  addMessage("jarvis", "Conversation cleared. Ready when you are.");
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

checkHealth();
