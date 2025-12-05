require("dotenv").config();
const express = require("express");
const askLuna = require("./gpt");
const supabase = require("./supabase");
const flow = require("./flow");
const { clienteExiste } = require("./utils");
const { guardarHistorial } = require("./dbSave");

const app = express();
app.use(express.json());

// Estado temporal por cliente
let sessions = {};

/* ======================================================
   🟣 WEBHOOK DE WHATAUTO
====================================================== */
app.post("/whatsapp", async (req, res) => {
  console.log("[DEBUG WHATAUTO]:", req.body);

  const { phone, message } = req.body;

  if (!phone || !message) {
    return res.json({ reply: "No recibí un mensaje válido." });
  }

  // Guardar historial del cliente
  guardarHistorial(phone, message, "cliente");

  // Crear sesión si no existe
  if (!sessions[phone]) sessions[phone] = flow.iniciarFlujo({}, phone);

  const state = sessions[phone];

  /* ======================================================
      1. VALIDAR CLIENTE EN SUPABASE
  ====================================================== */
  if (state.step === "validar_cliente") {
    const existe = await clienteExiste(p
