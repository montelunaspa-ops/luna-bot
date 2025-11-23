import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(bodyParser.json());

/* ============================================================
    🔍 ENDPOINT PARA VER LO QUE WHATAUTO ESTÁ ENVIANDO
   ============================================================ */
app.post("/debug-whatsauto", (req, res) => {
  console.log("📦 Datos recibidos desde WhatsAuto:", req.body);

  return res.json({
    recibido: req.body,
    mensaje: "OK — Aquí están los datos que WhatsAuto envió."
  });
});

/* ============================================================
    🚀 PRUEBA SIMPLE
   ============================================================ */
app.get("/", (req, res) => {
  res.send("Debug activo ✔️");
});

/* ============================================================
    🔌 PUERTO
   ============================================================ */
const PORT = parseInt(process.env.PORT) || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Servidor de debug arriba en puerto ${PORT}`)
);
