import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { crearApp } from "./app.js";
import { crearDb } from "./db.js";
import { sembrarDemo } from "./seed.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// PORT lo inyecta el hosting; 3000 es solo para local.
const PUERTO = Number(process.env.PORT ?? 3000);
const RUTA_DB = process.env.DB ?? join(__dirname, "..", "data", "turnos.db");

const db = crearDb(RUTA_DB);

// En hosting gratuito el disco es efímero: si la base quedó vacía
// después de un reinicio, la volvemos a poblar para que la demo se vea.
if (process.env.SEED_DEMO !== "false") {
  const sembrados = sembrarDemo(db);
  if (sembrados > 0) {
    console.log(`Base vacía: cargué ${sembrados} turnos de ejemplo.`);
  }
}

const app = crearApp(db);

const server = app.listen(PUERTO, "0.0.0.0", () => {
  console.log(`API de turnos escuchando en el puerto ${PUERTO}`);
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
