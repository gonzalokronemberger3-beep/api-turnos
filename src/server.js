import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { crearApp } from "./app.js";
import { crearDb } from "./db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const PUERTO = Number(process.env.PORT ?? 3000);
const RUTA_DB = process.env.DB ?? join(__dirname, "..", "data", "turnos.db");

const db = crearDb(RUTA_DB);
const app = crearApp(db);

const server = app.listen(PUERTO, () => {
  console.log(`API de turnos escuchando en http://localhost:${PUERTO}`);
  console.log(`Interfaz: http://localhost:${PUERTO}/`);
  console.log(`Base de datos: ${RUTA_DB}`);
});

// Cierre ordenado: si el proceso muere, SQLite no queda a medio escribir.
for (const senal of ["SIGINT", "SIGTERM"]) {
  process.on(senal, () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
}
