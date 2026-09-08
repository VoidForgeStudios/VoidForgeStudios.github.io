
const express = require("express");
const cors = require("cors");

const app = express();

const PORT = process.env.PORT || 3000;

const GROQ_BASE = "https://api.groq.com/openai/v1";

const PREFERRED_MODELS = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "llama-3.1-8b-instant"
];


/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(express.json({ limit: "1mb" }));

app.use(cors({
  origin: function (origin, callback) {

    // Allow requests without an Origin header
    // such as curl/server-to-server requests.
    if (!origin) {
      return callback(null, true);
    }

    const allowed =
      process.env.JARVIS_ALLOWED_ORIGIN;

    if (!allowed) {
      console.warn(
        "WARNING: JARVIS_ALLOWED_ORIGIN is not configured."
      );

      return callback(null, true);
    }

    if (origin === allowed) {
      return callback(null, true);
    }

    return callback(
      new Error("CORS origin not allowed")
    );
  },

  methods: ["POST", "OPTIONS"],

  allowedHeaders: [
    "Content-Type",
    "Authorization"
  ]
}));


/* =========================================================
   GROQ
========================================================= */

async function groqJson(path, apiKey, options = {}) {

  const response = await fetch(
    `${GROQ_BASE}${path}`,
    {
      ...options,

      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      }
    }
  );


  const data =
    await response.json().catch(() => ({}));


  if (!response.ok) {

    const message =
      data?.error?.message ||
      `Groq request failed with ${response.status}`;

    const error =
      new Error(message);

    error.status =
      response.status;

    throw error;
  }


  return data;
}


/* =========================================================
   MODEL SELECTION
========================================================= */

async function modelFor(apiKey) {

  const data =
    await groqJson(
      "/models",
      apiKey,
      {
        method: "GET"
      }
    );


  const ids =
    new Set(
      (data?.data || [])
        .map(model => model?.id)
        .filter(Boolean)
    );


  const model =
    PREFERRED_MODELS.find(
      id => ids.has(id)
    );


  if (!model) {
    throw new Error(
      "This Groq key has no compatible chat model available."
    );
  }


  return model;
}


/* =========================================================
   CHAT
========================================================= */

async function chat(
  apiKey,
  model,
  messages,
  maxTokens,
  temperature
) {

  const data =
    await groqJson(
      "/chat/completions",
      apiKey,
      {
        method: "POST",

        body: JSON.stringify({
          model,
          messages,
          max_completion_tokens: maxTokens,
          temperature
        })
      }
    );


  return (
    data?.choices?.[0]?.message?.content?.trim() ||
    "No response was returned."
  );
}


/* =========================================================
   MESSAGE NORMALIZATION
========================================================= */

function normaliseMessages(messages) {

  if (!Array.isArray(messages)) {
    return [];
  }


  return messages
    .filter(item =>
      item &&
      (
        item.role === "user" ||
        item.role === "assistant" ||
        item.role === "system"
      )
    )
    .slice(-20)
    .map(item => ({
      role: item.role,
      content:
        String(item.content || "")
          .slice(0, 12000)
    }));
}


/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/", (req, res) => {

  res.json({
    name: "JARVIS Backend",
    status: "online",
    endpoint: "/api/jarvis",
    method: "POST"
  });

});


app.get("/api/jarvis", (req, res) => {

  res.status(405).json({
    error: "Method not allowed.",
    message:
      "JARVIS API requires a POST request."
  });

});


/* =========================================================
   JARVIS API
========================================================= */

app.post("/api/jarvis", async (req, res) => {

  try {

    /* -----------------------------------------------------
       AUTHENTICATION
    ----------------------------------------------------- */

    const expectedToken =
      process.env.JARVIS_ACCESS_TOKEN;

    const authorization =
      String(
        req.headers.authorization || ""
      );

    const suppliedToken =
      authorization.replace(
        /^Bearer\s+/i,
        ""
      );


    if (
      !expectedToken ||
      !suppliedToken ||
      suppliedToken !== expectedToken
    ) {

      return res.status(401).json({
        error: "JARVIS access denied."
      });

    }


    /* -----------------------------------------------------
       API KEYS
    ----------------------------------------------------- */

    const workers = [
      process.env.GROQ_WORKER_1_API_KEY,
      process.env.GROQ_WORKER_2_API_KEY,
      process.env.GROQ_WORKER_3_API_KEY
    ].filter(Boolean);


    const masterKey =
      process.env.GROQ_MASTER_API_KEY;


    if (!masterKey) {

      return res.status(503).json({
        error:
          "Master JARVIS is not configured on the server."
      });

    }


    if (!workers.length) {

      return res.status(503).json({
        error:
          "No JARVIS worker keys are configured on the server."
      });

    }


    /* -----------------------------------------------------
       REQUEST
    ----------------------------------------------------- */

    const body =
      req.body || {};


    const userText =
      String(
        body.message || ""
      ).trim();


    if (
      !userText ||
      userText.length > 20000
    ) {

      return res.status(400).json({
        error:
          "A valid message is required."
      });

    }


    const history =
      normaliseMessages(
        body.messages
      );


    const memory =
      String(
        body.memory ||
        "No saved memories."
      ).slice(0, 10000);


    /* -----------------------------------------------------
       WORKERS
    ----------------------------------------------------- */

    const workerResults =
      await Promise.allSettled(

        workers.map(
          async (key, index) => {

            const model =
              await modelFor(key);


            const report =
              await chat(
                key,
                model,
                [
                  {
                    role: "system",

                    content:
                      `You are JARVIS Worker ${index + 1}. Independently analyse the user's request and provide a concise, factual report for Master JARVIS. Do not reveal hidden reasoning or chain-of-thought. Flag uncertainty and conflicts.

Saved user memories:
${memory}`
                  },

                  ...history,

                  {
                    role: "user",
                    content: userText
                  }
                ],

                768,
                0.45
              );


            return {
              worker: index + 1,
              model,
              report
            };

          }
        )

      );


    const reports =
      workerResults
        .filter(
          result =>
            result.status === "fulfilled"
        )
        .map(
          result =>
            result.value
        );


    if (!reports.length) {

      const errors =
        workerResults
          .map(result =>
            result.status === "rejected"
              ? result.reason?.message
              : ""
          )
          .filter(Boolean);


      return res.status(502).json({
        error:
          errors[0] ||
          "All JARVIS workers failed."
      });

    }


    /* -----------------------------------------------------
       MASTER
    ----------------------------------------------------- */

    const masterModel =
      await modelFor(masterKey);


    const reportText =
      reports
        .map(
          item =>
            `WORKER ${item.worker} (${item.model}):
${item.report}`
        )
        .join("\n\n");


    const finalAnswer =
      await chat(
        masterKey,
        masterModel,
        [
          {
            role: "system",

            content:
              "You are MASTER JARVIS. Produce the single final answer to the user using the worker reports below. Be concise, intelligent, professional, subtly British when natural, and honest about uncertainty. Resolve conflicts where possible; if they cannot be resolved, say so. Never mention hidden chain-of-thought. Do not claim actions were performed unless they actually were."
          },

          ...history,

          {
            role: "user",

            content:
              `User request:
${userText}

Worker reports:
${reportText}`
          }
        ],

        1024,
        0.3
      );


    /* -----------------------------------------------------
       RESPONSE
    ----------------------------------------------------- */

    return res.status(200).json({

      answer: finalAnswer,

      workers:
        reports.map(item => ({
          worker: item.worker,
          model: item.model
        })),

      masterModel,

      workerCount:
        reports.length

    });


  } catch (error) {

    console.error(
      "JARVIS ERROR:",
      error
    );


    return res.status(
      error?.status >= 400 &&
      error?.status < 600
        ? error.status
        : 500
    ).json({

      error:
        error?.message ||
        "Internal JARVIS server error."

    });

  }

});


/* =========================================================
   SERVER
========================================================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `JARVIS backend listening on port ${PORT}`
    );

    console.log(
      `POST /api/jarvis`
    );

  }
);
