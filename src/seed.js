/**
 * Carga datos de ejemplo si la base está vacía.
 *
 * En un hosting gratuito el disco es efímero: cada reinicio borra la base.
 * Sin esto, el que abre el link se encuentra una pantalla vacía y piensa
 * que la app está rota.
 */
export function sembrarDemo(db) {
  const { total } = db.prepare("SELECT COUNT(*) AS total FROM turnos").get();
  if (total > 0) return 0;

  const insertar = db.prepare(`
    INSERT INTO turnos (cliente, telefono, servicio, inicio, fin, estado, notas, creado_en)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const enDias = (dias, hora, minuto = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    d.setHours(hora, minuto, 0, 0);
    return d;
  };

  const ejemplos = [
    { cliente: "Ana Pérez", telefono: "+54 11 5555-1234", servicio: "Corte de pelo", dias: 1, hora: 10, min: 0, dur: 30 },
    { cliente: "Bruno Díaz", telefono: "+54 11 5555-8765", servicio: "Color", dias: 1, hora: 11, min: 0, dur: 60 },
    { cliente: "Carla Gómez", telefono: null, servicio: "Corte + barba", dias: 2, hora: 9, min: 30, dur: 45 },
    { cliente: "Diego Ruiz", telefono: "+54 11 5555-0000", servicio: "Corte de pelo", dias: 2, hora: 15, min: 0, dur: 30 },
  ];

  const ahora = new Date().toISOString();

  for (const e of ejemplos) {
    const inicio = enDias(e.dias, e.hora, e.min);
    const fin = new Date(inicio.getTime() + e.dur * 60_000);

    insertar.run(
      e.cliente,
      e.telefono,
      e.servicio,
      inicio.toISOString(),
      fin.toISOString(),
      "pendiente",
      null,
      ahora
    );
  }

  return ejemplos.length;
}
