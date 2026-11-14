import { Router } from "express";

// Horario de atención del negocio (hora local del servidor).
const APERTURA = 9;
const CIERRE = 18;
const PASO_MIN = 30;

export function rutasDisponibilidad(db) {
  const router = Router();

  const ocupados = db.prepare(`
    SELECT inicio, fin FROM turnos
    WHERE estado != 'cancelado'
      AND inicio < ? AND ? < fin
    ORDER BY inicio ASC
  `);

  // ---------------------------------------------------------------
  // GET /api/disponibilidad?fecha=2026-11-20&duracion=30
  // ---------------------------------------------------------------
  router.get("/", (req, res) => {
    const { fecha } = req.query;
    const duracion = Number(req.query.duracion ?? 30);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha ?? "")) {
      return res.status(400).json({
        error: "parametros_invalidos",
        detalles: [{ campo: "fecha", mensaje: "formato esperado: YYYY-MM-DD" }],
      });
    }
    if (!Number.isInteger(duracion) || duracion < 5 || duracion > 480) {
      return res.status(400).json({
        error: "parametros_invalidos",
        detalles: [{ campo: "duracion", mensaje: "entero entre 5 y 480" }],
      });
    }

    const [anio, mes, dia] = fecha.split("-").map(Number);
    const diaBase = new Date(anio, mes - 1, dia);
    if (diaBase.getMonth() !== mes - 1) {
      return res.status(400).json({
        error: "parametros_invalidos",
        detalles: [{ campo: "fecha", mensaje: "esa fecha no existe" }],
      });
    }

    const inicioDia = new Date(anio, mes - 1, dia, 0, 0, 0, 0);
    const finDia = new Date(anio, mes - 1, dia + 1, 0, 0, 0, 0);
    const tomados = ocupados.all(finDia.toISOString(), inicioDia.toISOString());

    const franjas = [];
    for (let m = APERTURA * 60; m + duracion <= CIERRE * 60; m += PASO_MIN) {
      const desde = new Date(anio, mes - 1, dia, 0, m, 0, 0);
      const hasta = new Date(desde.getTime() + duracion * 60_000);

      const libre = !tomados.some(
        (t) => new Date(t.inicio) < hasta && desde < new Date(t.fin)
      );

      franjas.push({ inicio: desde.toISOString(), disponible: libre });
    }

    res.json({ fecha, duracion, franjas });
  });

  return router;
}
