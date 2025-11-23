import express from "express";

const app = express();
app.use(express.json());

// --- Endpoint para probar desde Postman ---
app.post("/debug-whatsapp", async (req, res) => {
  console.log("📩 Request recibido en /debug-whatsapp:");
  console.log("Headers:", req.headers);
  console.log("Body:", req.body);

  return res.json({
    ok: true,
    message: "Request recibido correctamente",
    data: req.body
  });
});

// --- Página raíz ---
app.get("/", (req, res) => {
  res.send("Servidor WhatsApp Bot activo 🚀");
});

// --- Iniciar servidor ---
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
});
