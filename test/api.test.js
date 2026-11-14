import test from "node:test";
import assert from "node:assert/strict";

import { crearApp } from "../src/app.js";
import { crearDb } from "../src/db.js";

/** Levanta la API en un puerto efímero, con base en memoria. */
function levantar() {
  const db = crearDb();
  const app = crearApp(db);
  const server = app.listen(0);

  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  return {
    base,
    db,
    cerrar: () =>
      new Promise((listo) => {
        server.close(() => {
          db.close();
          listo();
        });
      }),
  };
}

/** Fecha futura en hora local, para que los tests no caduquen. */
function enDias(dias, hora = 10, minuto = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  d.setHours(hora, minuto, 0, 0);
  return d;
}

function turnoEjemplo(extra = {}) {
  return {
    cliente: "Ana Pérez",
    telefono: "+54 11 5555-1234",
    servicio: "Corte de pelo",
    inicio: enDias(2).toISOString(),
    duracion_min: 30,
    ...extra,
  };
}

async function post(base, cuerpo) {
  return fetch(`${base}/api/turnos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
}

// ------------------------------------------------------------------
test("POST crea un turno y devuelve 201 con Location", async (t) => {
  const { base, cerrar } = levantar();
  t.after(cerrar);

  const res = await post(base, turnoEjemplo());
  assert.equal(res.status, 201);

  const creado = await res.json();
  assert.ok(creado.id > 0);
  assert.equal(creado.cliente, "Ana Pérez");
  assert.equal(creado.estado, "pendiente");
  assert.equal(res.headers.get("location"), `/api/turnos/${creado.id}`);

  // fin = inicio + 30 minutos
  const minutos = (new Date(creado.fin) - new Date(creado.inicio)) / 60_000;
  assert.equal(minutos, 30);
});

test("POST rechaza datos incompletos con 400 y detalle por campo", async (t) => {
  const { base, cerrar } = levantar();
  t.after(cerrar);

  const res = await post(base, { servicio: "Corte" });
  assert.equal(res.status, 400);

  const cuerpo = await res.json();
  assert.equal(cuerpo.error, "datos_invalidos");
  const campos = cuerpo.detalles.map((d) => d.campo);
  assert.ok(campos.includes("cliente"));
  assert.ok(campos.includes("inicio"));
  assert.ok(campos.includes("duracion_min"));
});

test("POST rechaza una fecha en el pasado", async (t) => {
  const { base, cerrar } = levantar();
  t.after(cerrar);

  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);

  const res = await post(base, turnoEjemplo({ inicio: ayer.toISOString() }));
  assert.equal(res.status, 400);

  const cuerpo = await res.json();
  assert.equal(cuerpo.detalles[0].campo, "inicio");
});

test("POST devuelve 409 si el horario ya está ocupado", async (t) => {
  const { base, cerrar } = levantar();
  t.after(cerrar);

  assert.equal((await post(base, turnoEjemplo())).status, 201);

  const res = await post(base, turnoEjemplo({ cliente: "Otro" }));
  assert.equal(res.status, 409);

  const cuerpo = await res.json();
  assert.equal(cuerpo.error, "turno_superpuesto");
});

test("POST acepta un turno que empieza justo cuando termina el anterior", async (t) => {
  const { base, cerrar } = levantar();
  t.after(cerrar);

  const primero = enDias(3, 10, 0);
  const segundo = enDias(3, 10, 30);

  assert.equal((await post(base, turnoEjemplo({ inicio: primero.toISOString() }))).status, 201);
  assert.equal((await post(base, turnoEjemplo({ inicio: segundo.toISOString() }))).status, 201);
});

test("GET lista filtrando por rango y por estado", async (t) => {
  const { base, cerrar } = levantar();
  t.after(cerrar);

  await post(base, turnoEjemplo({ inicio: enDias(4, 9).toISOString() }));
  await post(base, turnoEjemplo({ inicio: enDias(4, 11).toISOString() }));
  await post(base, turnoEjemplo({ inicio: enDias(10, 11).toISOString() }));

  const desde = enDias(4, 0);
  const hasta = enDias(5, 0);
  const res = await fetch(
    `${base}/api/turnos?desde=${desde.toISOString()}&hasta=${hasta.toISOString()}`
  );
  const { total, turnos } = await res.json();

  assert.equal(res.status, 200);
  assert.equal(total, 2);
  assert.equal(turnos.length, 2);

  // ordenados por hora
  assert.ok(new Date(turnos[0].inicio) < new Date(turnos[1].inicio));
});

test("PATCH cambia el estado del turno", async (t) => {
  const { base, cerrar } = levantar();
  t.after(cerrar);

  const creado = await (await post(base, turnoEjemplo())).json();

  const res = await fetch(`${base}/api/turnos/${creado.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ estado: "confirmado" }),
  });

  assert.equal(res.status, 200);
  assert.equal((await res.json()).estado, "confirmado");
});

test("PATCH rechaza un estado inventado", async (t) => {
  const { base, cerrar } = levantar();
  t.after(cerrar);

  const creado = await (await post(base, turnoEjemplo())).json();

  const res = await fetch(`${base}/api/turnos/${creado.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ estado: "casi seguro" }),
  });

  assert.equal(res.status, 400);
});

test("PATCH permitido mover el turno a un horario libre", async (t) => {
  const { base, cerrar } = levantar();
  t.after(cerrar);

  const creado = await (await post(base, turnoEjemplo())).json();

  const res = await fetch(`${base}/api/turnos/${creado.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ inicio: enDias(2, 15).toISOString() }),
  });

  assert.equal(res.status, 200);
  const actualizado = await res.json();
  assert.equal(new Date(actualizado.inicio).getHours(), 15);
  // la duración original se conserva
  const minutos = (new Date(actualizado.fin) - new Date(actualizado.inicio)) / 60_000;
  assert.equal(minutos, 30);
});

test("DELETE borra y después responde 404", async (t) => {
  const { base, cerrar } = levantar();
  t.after(cerrar);

  const creado = await (await post(base, turnoEjemplo())).json();

  const res = await fetch(`${base}/api/turnos/${creado.id}`, { method: "DELETE" });
  assert.equal(res.status, 204);

  const otra = await fetch(`${base}/api/turnos/${creado.id}`);
  assert.equal(otra.status, 404);
});

test("GET /api/turnos/:id con id inexistente da 404", async (t) => {
  const { base, cerrar } = levantar();
  t.after(cerrar);

  const res = await fetch(`${base}/api/turnos/9999`);
  assert.equal(res.status, 404);
});

test("la disponibilidad marca ocupado el horario tomado", async (t) => {
  const { base, cerrar } = levantar();
  t.after(cerrar);

  const dia = enDias(5, 10, 0);
  await post(base, turnoEjemplo({ inicio: dia.toISOString(), duracion_min: 60 }));

  const fecha = [
    dia.getFullYear(),
    String(dia.getMonth() + 1).padStart(2, "0"),
    String(dia.getDate()).padStart(2, "0"),
  ].join("-");

  const res = await fetch(`${base}/api/disponibilidad?fecha=${fecha}&duracion=30`);
  assert.equal(res.status, 200);

  const { franjas } = await res.json();
  assert.ok(franjas.length > 0);

  const aLas10 = franjas.find((f) => new Date(f.inicio).getHours() === 10);
  const aLas1030 = franjas.find(
    (f) => new Date(f.inicio).getHours() === 10 && new Date(f.inicio).getMinutes() === 30
  );
  const aLas11 = franjas.find((f) => new Date(f.inicio).getHours() === 11);

  assert.equal(aLas10.disponible, false);
  assert.equal(aLas1030.disponible, false);
  assert.equal(aLas11.disponible, true);
});

test("la disponibilidad rechaza una fecha con formato inválido", async (t) => {
  const { base, cerrar } = levantar();
  t.after(cerrar);

  const res = await fetch(`${base}/api/disponibilidad?fecha=20-11-2026`);
  assert.equal(res.status, 400);
});
