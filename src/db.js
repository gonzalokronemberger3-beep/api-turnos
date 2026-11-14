import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const ESQUEMA = `
  CREATE TABLE IF NOT EXISTS turnos (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente   TEXT    NOT NULL,
    telefono  TEXT,
    servicio  TEXT    NOT NULL,
    inicio    TEXT    NOT NULL,
    fin       TEXT    NOT NULL,
    estado    TEXT    NOT NULL DEFAULT 'pendiente',
    notas     TEXT,
    creado_en TEXT    NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_turnos_inicio ON turnos(inicio);
  CREATE INDEX IF NOT EXISTS idx_turnos_estado ON turnos(estado);
`;

/**
 * Abre (y crea si hace falta) la base de datos.
 * Sin argumentos usa memoria, que es lo que necesitan los tests.
 */
export function crearDb(ruta = ":memory:") {
  if (ruta !== ":memory:") {
    mkdirSync(dirname(ruta), { recursive: true });
  }

  const db = new DatabaseSync(ruta);
  db.exec(ESQUEMA);
  return db;
}
