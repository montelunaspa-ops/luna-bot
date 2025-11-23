import express from "express";

const app = express();

// Soporte para JSON
app.use(express.json());

// Soporte para application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

app.post("/debug-whatsapp", async (req, res) => {
  console.log("📩 Request recibido en /debug-whatsapp:");
  console.log("Headers:", req.headers);
  console.log("Body:", req.body); // ← AHORA SÍ FUNCIONA

  return res.json({
    ok: true,
    message: "Request recibido correctamente",
    data: req.body
  });
});

app.get("/", (req, res) => {
  res.send("Servidor WhatsApp Bot activo 🚀");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
});
