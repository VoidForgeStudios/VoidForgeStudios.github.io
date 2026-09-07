const express = require("express");
const jarvisHandler = require("./api/jarvis");

const app = express();
const port = Number(process.env.PORT || 10000);

app.use(express.json({ limit: "256kb" }));

app.get("/", (_req, res) => {
  res.status(200).json({ status: "ok", service: "jarvis-backend" });
});

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "jarvis-backend" });
});

app.post("/api/jarvis", jarvisHandler);

app.listen(port, "0.0.0.0", () => {
  console.log(`JARVIS backend listening on 0.0.0.0:${port}`);
});
