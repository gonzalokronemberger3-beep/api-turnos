import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { crearApp } from "../src/app.js";
import { crearDb } from "../src/db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUTA_DB = join(__dirname, "..", "data", "turnos.db");

// Base de datos de demostración: la misma que usa `npm start`.
const db = crearDb(RUTA_DB);
const app = crearApp(db);
const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

function enDias(dias, hora, minuto = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  d.setHours(hora, minuto, 0, 0);
  return d.toISOString();
}

const ejemplos = [
  { cliente: "Ana Pérez", telefono: "+54 11 5555-1234", servicio: "Corte de pelo", inicio: enDias(1, 10, 0), duracion_min: 30 },
  { cliente: "Bruno Díaz", telefono: "+54 11 5555-8765", servicio: "Color", inicio: enDias(1, 11, 0), duracion_min: 60 },
  { cliente: "Carla Gómez", telefono: null, servicio: "Corte + barba", inicio: enDias(2, 9, 30), duracion_min: 45 },
  { cliente: "Diego Ruiz", telefono: "+54 11 5555-0000", servicio: "Corte de pelo", inicio: enDias(2, 15, 0), duracion_min: 30 },
];

async function main() {
  console.log(`Sembrando datos de ejemplo en ${RUTA_DB}\n`);

  for (const turno of ejemplos) {
    const res = await fetch(`${base}/api/turnos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(turno),
    });

    if (res.status === 201) {
      const creado = await res.json();
      console.log(`  ✓ ${creado.cliente.padEnd(14)} ${creado.servicio.padEnd(16)} ${creado.inicio}`);
    } else {
      const err = await res.json();
      console.log(`  – ${turno.cliente.padEnd(14)} omitido (${err.error})`);
    }
  }

  const lista = await (await fetch(`${base}/api/turnos`)).json();
  console.log(`\nTotal en la base: ${lista.total} turnos`);
}

await main();
server.close();
db.close();
