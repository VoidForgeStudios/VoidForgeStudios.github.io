const GROQ_BASE = "https://api.groq.com/openai/v1";
const PREFERRED_MODELS = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "llama-3.1-8b-instant"
];

function setCors(req, res) {
  const configured = process.env.JARVIS_ALLOWED_ORIGIN;
  const origin = req.headers.origin || "";
  const allowed = !configured || origin === configured;

  if (configured && allowed) res.setHeader("Access-Control-Allow-Origin", configured);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  return allowed;
}

function configuredKeys() {
  return [
    process.env.GROQ_WORKER_1_API_KEY,
    process.env.GROQ_WORKER_2_API_KEY,
    process.env.GROQ_WORKER_3_API_KEY
  ].filter(Boolean);
}

async function groqJson(path, apiKey, options = {}) {
  const response = await fetch(`${GROQ_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || `Groq request failed with ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function modelFor(apiKey) {
  const data = await groqJson("/models", apiKey, { method: "GET" });
  const ids = new Set((data?.data || []).map(model => model?.id).filter(Boolean));
  const model = PREFERRED_MODELS.find(id => ids.has(id));
  if (!model) throw new Error("This Groq key has no compatible chat model available.");
  return model;
}

async function chat(apiKey, model, messages, maxTokens, temperature) {
  const data = await groqJson("/chat/completions", apiKey, {
    method: "POST",
    body: JSON.stringify({ model, messages, max_completion_tokens: maxTokens, temperature })
  });
  return data?.choices?.[0]?.message?.content?.trim() || "No response was returned.";
}

function normaliseMessages(messages, currentUserText) {
  if (!Array.isArray(messages)) return [];
  const cleaned = messages
    .filter(item => item && (item.role === "user" || item.role === "assistant" || item.role === "system"))
    .map(item => ({
      role: item.role,
      content: String(item.content || "").slice(0, 12000)
    }));

  const last = cleaned[cleaned.length - 1];
  if (last?.role === "user" && last.content.trim() === currentUserText.trim()) cleaned.pop();
  return cleaned.slice(-20);
}

module.exports = async function handler(req, res) {
  const allowed = setCors(req, res);

  if (req.method === "OPTIONS") return res.status(allowed ? 204 : 403).end();
  if (!allowed) return res.status(403).json({ error: "Origin not allowed." });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  const expectedToken = process.env.JARVIS_ACCESS_TOKEN;
  const suppliedToken = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!expectedToken || !suppliedToken || suppliedToken !== expectedToken) {
    return res.status(401).json({ error: "JARVIS access denied." });
  }

  const workers = configuredKeys();
  const masterKey = process.env.GROQ_MASTER_API_KEY;
  if (!masterKey) return res.status(503).json({ error: "Master JARVIS is not configured on the server." });
  if (!workers.length) return res.status(503).json({ error: "No JARVIS worker keys are configured on the server." });

  const body = req.body || {};
  const userText = String(body.message || "").trim();
  if (!userText || userText.length > 20000) return res.status(400).json({ error: "A valid message is required." });

  const history = normaliseMessages(body.messages, userText);
  const memory = String(body.memory || "No saved memories.").slice(0, 10000);

  const workerResults = await Promise.allSettled(workers.map(async (key, index) => {
    const model = await modelFor(key);
    const report = await chat(key, model, [
      {
        role: "system",
        content: `You are JARVIS Worker ${index + 1}. Independently analyse the user's request and provide a concise, factual report for Master JARVIS. Do not reveal hidden reasoning or chain-of-thought. Flag uncertainty and conflicts.\n\nSaved user memories:\n${memory}`
      },
      ...history,
      { role: "user", content: userText }
    ], 768, 0.45);
    return { worker: index + 1, model, report };
  }));

  const reports = workerResults
    .filter(result => result.status === "fulfilled")
    .map(result => result.value);

  if (!reports.length) {
    const errors = workerResults.map(result => result.status === "rejected" ? result.reason?.message : "").filter(Boolean);
    return res.status(502).json({ error: errors[0] || "All JARVIS workers failed." });
  }

  try {
    const masterModel = await modelFor(masterKey);
    const reportText = reports.map(item => `WORKER ${item.worker} (${item.model}):\n${item.report}`).join("\n\n");
    const finalAnswer = await chat(masterKey, masterModel, [
      {
        role: "system",
        content: "You are MASTER JARVIS. Produce the single final answer to the user using the worker reports below. Be concise, intelligent, professional, subtly British when natural, and honest about uncertainty. Resolve conflicts where possible; if they cannot be resolved, say so. Never mention hidden chain-of-thought. Do not claim actions were performed unless they actually were."
      },
      ...history,
      { role: "user", content: `User request:\n${userText}\n\nWorker reports:\n${reportText}` }
    ], 1024, 0.3);

    return res.status(200).json({
      answer: finalAnswer,
      workers: reports.map(item => ({ worker: item.worker, model: item.model })),
      masterModel,
      workerCount: reports.length
    });
  } catch (error) {
    return res.status(502).json({ error: error?.message || "Master JARVIS failed." });
  }
};
