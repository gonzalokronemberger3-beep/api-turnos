import express from "express";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { rutasTurnos } from "./rutas/turnos.js";
import { rutasDisponibilidad } from "./rutas/disponibilidad.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLICO = join(__dirname, "..", "public");

/**
 * Arma la app sin escuchar en ningún puerto.
 * Los tests le pasan una base en memoria; el server una en disco.
 */
export function crearApp(db) {
  const app = express();

  app.use(express.json({ limit: "100kb" }));
  app.use(express.static(PUBLICO));

  app.get("/api/salud", (req, res) => {
    res.json({ ok: true, servicio: "api-turnos" });
  });

  app.use("/api/turnos", rutasTurnos(db));
  app.use("/api/disponibilidad", rutasDisponibilidad(db));

  // Cualquier otra ruta /api/* es 404 en JSON, no en HTML.
  app.use("/api", (req, res) => {
    res.status(404).json({ error: "no_encontrado" });
  });

  // Manejo centralizado de errores.
  app.use((err, req, res, next) => {
    if (err?.type === "entity.parse.failed") {
      return res.status(400).json({ error: "json_invalido" });
    }
    console.error("[error]", err);
    res.status(500).json({ error: "error_interno" });
  });

  return app;
}
