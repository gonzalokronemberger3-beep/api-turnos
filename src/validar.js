export const ESTADOS = ["pendiente", "confirmado", "cancelado", "asistio"];

const MIN_DURACION = 5;
const MAX_DURACION = 480;

const esTexto = (v) => typeof v === "string" && v.trim() !== "";

const largoEntre = (v, min, max) => {
  const t = v.trim();
  return t.length >= min && t.length <= max;
};

/**
 * Devuelve un array de errores: [{ campo, mensaje }].
 * Array vacío = datos válidos.
 *
 * @param {object} datos
 * @param {object} opciones
 * @param {boolean} opciones.parcial   true = validar solo los campos presentes (PATCH)
 * @param {boolean} opciones.futuro    true = exigir que `inicio` sea posterior a ahora
 * @param {Date}    opciones.ahora     inyectable para poder testear sin depender del reloj
 */
export function erroresDe(datos, opciones = {}) {
  const { parcial = false, futuro = false, ahora = new Date() } = opciones;

  const errores = [];
  const tiene = (campo) => Object.hasOwn(datos, campo);
  const revisar = (campo) => !parcial || tiene(campo);

  if (revisar("cliente")) {
    if (!esTexto(datos.cliente)) {
      errores.push({ campo: "cliente", mensaje: "obligatorio" });
    } else if (!largoEntre(datos.cliente, 2, 80)) {
      errores.push({ campo: "cliente", mensaje: "tiene que tener entre 2 y 80 caracteres" });
    }
  }

  if (revisar("servicio")) {
    if (!esTexto(datos.servicio)) {
      errores.push({ campo: "servicio", mensaje: "obligatorio" });
    } else if (!largoEntre(datos.servicio, 2, 80)) {
      errores.push({ campo: "servicio", mensaje: "tiene que tener entre 2 y 80 caracteres" });
    }
  }

  if (revisar("inicio")) {
    const fecha = new Date(datos.inicio);
    if (datos.inicio == null || Number.isNaN(fecha.getTime())) {
      errores.push({ campo: "inicio", mensaje: "tiene que ser una fecha válida (ISO 8601)" });
    } else if (futuro && fecha.getTime() <= ahora.getTime()) {
      errores.push({ campo: "inicio", mensaje: "tiene que ser una fecha futura" });
    }
  }

  if (revisar("duracion_min")) {
    const d = datos.duracion_min;
    if (!Number.isInteger(d)) {
      errores.push({ campo: "duracion_min", mensaje: "tiene que ser un entero" });
    } else if (d < MIN_DURACION || d > MAX_DURACION) {
      errores.push({
        campo: "duracion_min",
        mensaje: `tiene que estar entre ${MIN_DURACION} y ${MAX_DURACION} minutos`,
      });
    }
  }

  if (tiene("estado") && !ESTADOS.includes(datos.estado)) {
    errores.push({ campo: "estado", mensaje: `tiene que ser uno de: ${ESTADOS.join(", ")}` });
  }

  if (tiene("telefono") && datos.telefono !== null && datos.telefono !== "") {
    if (typeof datos.telefono !== "string" || !/^[0-9+\s()-]{6,25}$/.test(datos.telefono)) {
      errores.push({ campo: "telefono", mensaje: "formato inválido" });
    }
  }

  if (tiene("notas") && datos.notas !== null) {
    if (typeof datos.notas !== "string" || datos.notas.length > 500) {
      errores.push({ campo: "notas", mensaje: "texto de hasta 500 caracteres" });
    }
  }

  return errores;
}
