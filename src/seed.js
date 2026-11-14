/**
 * Carga datos de ejemplo si la base está vacía.
 *
 * En un hosting gratuito el disco es efímero: cada reinicio borra la base.
 * Sin esto, el que abre el link se encuentra una pantalla vacía y piensa
 * que la app está rota.
 *
 * Los horarios se calculan respecto de "ahora" para que siempre haya un
 * turno próximo: una demo con fechas fijas se ve vacía a la semana.
 */
export function sembrarDemo(db) {
  const { total } = db.prepare("SELECT COUNT(*) AS total FROM turnos").get();
  if (total > 0) return 0;

  const insertar = db.prepare(`
    INSERT INTO turnos (cliente, telefono, servicio, inicio, fin, estado, notas, creado_en)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const ahora = new Date();

  // Próxima media hora, al menos 45 minutos después de ahora.
  const proximo = new Date(ahora.getTime() + 45 * 60_000);
  proximo.setSeconds(0, 0);
  proximo.setMinutes(Math.ceil(proximo.getMinutes() / 30) * 30);

  // Si cae fuera del horario de atención, se mueve al día siguiente a las 10 ART
  // (13:00 UTC): la agenda muestra 09:00-18:00 y un turno a las 23 no cierra.
  if (proximo.getUTCHours() < 11 || proximo.getUTCHours() >= 22) {
    proximo.setUTCDate(proximo.getUTCDate() + 1);
    proximo.setUTCHours(13, 0, 0, 0);
  }

  const enDias = (dias, horaUtc, minuto = 0) => {
    const d = new Date(proximo);
    d.setUTCDate(d.getUTCDate() + dias);
    d.setUTCHours(horaUtc, minuto, 0, 0);
    return d;
  };

  const ejemplos = [
    { cliente: "Ana Pérez", telefono: "+54 11 5555-1234", servicio: "Corte de pelo", inicio: proximo, dur: 30 },
    { cliente: "Bruno Díaz", telefono: "+54 11 5555-8765", servicio: "Color", inicio: new Date(proximo.getTime() + 60 * 60_000), dur: 60 },
    { cliente: "Carla Gómez", telefono: null, servicio: "Corte + barba", inicio: enDias(1, 12, 30), dur: 45 },
    { cliente: "Diego Ruiz", telefono: "+54 11 5555-0000", servicio: "Corte de pelo", inicio: enDias(1, 18, 0), dur: 30 },
  ];

  const creado = new Date().toISOString();

  for (const e of ejemplos) {
    const fin = new Date(e.inicio.getTime() + e.dur * 60_000);

    insertar.run(
      e.cliente,
      e.telefono,
      e.servicio,
      e.inicio.toISOString(),
      fin.toISOString(),
      "pendiente",
      null,
      creado
    );
  }

  return ejemplos.length;
}
