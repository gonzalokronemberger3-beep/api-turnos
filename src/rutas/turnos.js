import { Router } from "express";
import { erroresDe } from "../validar.js";

const LIMITE_MAX = 200;
const DESDE_MIN = "1970-01-01T00:00:00.000Z";
const HASTA_MAX = "9999-12-31T00:00:00.000Z";

export function rutasTurnos(db) {
  const router = Router();

  const porId = db.prepare("SELECT * FROM turnos WHERE id = ?");

  const listar = db.prepare(`
    SELECT * FROM turnos
    WHERE inicio >= ? AND inicio < ?
      AND (? = '' OR estado = ?)
    ORDER BY inicio ASC
    LIMIT ? OFFSET ?
  `);

  const contar = db.prepare(`
    SELECT COUNT(*) AS total FROM turnos
    WHERE inicio >= ? AND inicio < ?
      AND (? = '' OR estado = ?)
  `);

  // Dos turnos se pisan si uno empieza antes de que termine el otro
  // y el otro empieza antes de que termine el primero.
  const superpuestos = db.prepare(`
    SELECT id, cliente, inicio, fin FROM turnos
    WHERE estado != 'cancelado'
      AND inicio < ? AND ? < fin
      AND (? IS NULL OR id != ?)
  `);

  const insertar = db.prepare(`
    INSERT INTO turnos (cliente, telefono, servicio, inicio, fin, estado, notas, creado_en)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const actualizar = db.prepare(`
    UPDATE turnos
    SET cliente = ?, telefono = ?, servicio = ?, inicio = ?, fin = ?,
        estado = ?, notas = ?
    WHERE id = ?
  `);

  const borrar = db.prepare("DELETE FROM turnos WHERE id = ?");

  const idValido = (id) => /^\d+$/.test(id);

  // ---------------------------------------------------------------
  // GET /api/turnos?desde=&hasta=&estado=&limite=&offset=
  // ---------------------------------------------------------------
  router.get("/", (req, res) => {
    const desde = req.query.desde ? new Date(req.query.desde) : new Date(DESDE_MIN);
    const hasta = req.query.hasta ? new Date(req.query.hasta) : new Date(HASTA_MAX);

    if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime())) {
      return res.status(400).json({
        error: "parametros_invalidos",
        detalles: [{ campo: "desde/hasta", mensaje: "tienen que ser fechas válidas" }],
      });
    }
    if (desde > hasta) {
      return res.status(400).json({
        error: "parametros_invalidos",
        detalles: [{ campo: "desde", mensaje: "no puede ser posterior a hasta" }],
      });
    }

    const estado = req.query.estado ?? "";
    const limite = Math.min(Number(req.query.limite ?? 50), LIMITE_MAX);
    const offset = Number(req.query.offset ?? 0);

    if (!Number.isInteger(limite) || limite < 1 || !Number.isInteger(offset) || offset < 0) {
      return res.status(400).json({
        error: "parametros_invalidos",
        detalles: [{ campo: "limite/offset", mensaje: "limite 1-200, offset >= 0" }],
      });
    }

    const args = [desde.toISOString(), hasta.toISOString(), estado, estado];
    const turnos = listar.all(...args, limite, offset);
    const { total } = contar.get(...args);

    res.json({ total, cantidad: turnos.length, turnos });
  });

  // ---------------------------------------------------------------
  // GET /api/turnos/:id
  // ---------------------------------------------------------------
  router.get("/:id", (req, res) => {
    if (!idValido(req.params.id)) {
      return res.status(400).json({ error: "id_invalido" });
    }
    const turno = porId.get(Number(req.params.id));
    if (!turno) {
      return res.status(404).json({ error: "turno_no_encontrado" });
    }
    res.json(turno);
  });

  // ---------------------------------------------------------------
  // POST /api/turnos
  // ---------------------------------------------------------------
  router.post("/", (req, res) => {
    const datos = req.body ?? {};
    const errores = erroresDe(datos, { futuro: true });

    if (errores.length) {
      return res.status(400).json({ error: "datos_invalidos", detalles: errores });
    }

    const inicio = new Date(datos.inicio);
    const fin = new Date(inicio.getTime() + datos.duracion_min * 60_000);

    const choque = superpuestos.all(fin.toISOString(), inicio.toISOString(), null, null);
    if (choque.length) {
      return res.status(409).json({
        error: "turno_superpuesto",
        mensaje: "ya hay un turno en ese horario",
        detalles: choque,
      });
    }

    const info = insertar.run(
      datos.cliente.trim(),
      datos.telefono ?? null,
      datos.servicio.trim(),
      inicio.toISOString(),
      fin.toISOString(),
      datos.estado ?? "pendiente",
      datos.notas ?? null,
      new Date().toISOString()
    );

    const creado = porId.get(Number(info.lastInsertRowid));
    res.status(201).location(`/api/turnos/${creado.id}`).json(creado);
  });

  // ---------------------------------------------------------------
  // PATCH /api/turnos/:id
  // ---------------------------------------------------------------
  router.patch("/:id", (req, res) => {
    if (!idValido(req.params.id)) {
      return res.status(400).json({ error: "id_invalido" });
    }

    const actual = porId.get(Number(req.params.id));
    if (!actual) {
      return res.status(404).json({ error: "turno_no_encontrado" });
    }

    const cambios = { ...req.body };
    delete cambios.id;
    delete cambios.creado_en;

    // Solo exijo fecha futura si me están cambiando el horario.
    const errores = erroresDe(cambios, {
      parcial: true,
      futuro: Object.hasOwn(cambios, "inicio"),
    });
    if (errores.length) {
      return res.status(400).json({ error: "datos_invalidos", detalles: errores });
    }

    const fusionado = {
      cliente: cambios.cliente ?? actual.cliente,
      telefono: cambios.telefono ?? actual.telefono,
      servicio: cambios.servicio ?? actual.servicio,
      inicio: cambios.inicio ?? actual.inicio,
      duracion_min:
        cambios.duracion_min ??
        Math.round((new Date(actual.fin) - new Date(actual.inicio)) / 60_000),
      estado: cambios.estado ?? actual.estado,
      notas: "notas" in cambios ? cambios.notas : actual.notas,
    };

    const inicio = new Date(fusionado.inicio);
    const fin = new Date(inicio.getTime() + fusionado.duracion_min * 60_000);

    // Cancelar un turno nunca puede chocar con otro.
    if (fusionado.estado !== "cancelado") {
      const choque = superpuestos.all(
        fin.toISOString(),
        inicio.toISOString(),
        actual.id,
        actual.id
      );
      if (choque.length) {
        return res.status(409).json({
          error: "turno_superpuesto",
          mensaje: "ese horario ya está ocupado",
          detalles: choque,
        });
      }
    }

    actualizar.run(
      fusionado.cliente,
      fusionado.telefono,
      fusionado.servicio,
      inicio.toISOString(),
      fin.toISOString(),
      fusionado.estado,
      fusionado.notas,
      actual.id
    );

    res.json(porId.get(actual.id));
  });

  // ---------------------------------------------------------------
  // DELETE /api/turnos/:id
  // ---------------------------------------------------------------
  router.delete("/:id", (req, res) => {
    if (!idValido(req.params.id)) {
      return res.status(400).json({ error: "id_invalido" });
    }
    const { changes } = borrar.run(Number(req.params.id));
    if (changes === 0) {
      return res.status(404).json({ error: "turno_no_encontrado" });
    }
    res.status(204).end();
  });

  return router;
}
