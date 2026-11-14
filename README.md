# API de Turnos

API REST para que un negocio chico (peluquería, consultorio, cancha, taller) gestione sus turnos: crear, mover, cancelar y consultar horarios libres.

Incluye una interfaz web mínima para probarla sin Postman.

**Demo en vivo:** <https://api-turnos-0axl.onrender.com> — se puede usar sin instalar nada.
El plan gratis duerme tras 15 minutos sin visitas; la primera carga puede tardar ~50 segundos.

**Stack:** Node 24 · Express 5 · SQLite (`node:sqlite`, sin dependencias nativas) · `node:test`

---

## Problema que resuelve

Un negocio chico agenda por WhatsApp. Eso genera tres problemas reales:

1. **Se superponen turnos** porque nadie tiene una vista única.
2. **No hay registro** de quién canceló ni cuándo.
3. **El cliente pregunta "¿tenés libre el jueves?"** y hay que revisar a mano.

Esta API resuelve los tres: valida solapamientos en el servidor, guarda todo y expone los horarios libres de un día en una sola llamada.

---

## Cómo correrlo

```bash
npm install
npm run demo     # carga 4 turnos de ejemplo
npm start        # http://localhost:3000
```

Abrí `http://localhost:3000` y ya podés agendar desde el navegador.

```bash
npm test         # 13 tests, base en memoria, sin tocar datos reales
```

---

## Endpoints

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/api/salud` | Health check |
| `GET` | `/api/turnos` | Lista con filtros `desde`, `hasta`, `estado`, `limite`, `offset` |
| `GET` | `/api/turnos/:id` | Un turno |
| `POST` | `/api/turnos` | Crea (valida y detecta solapamientos) |
| `PATCH` | `/api/turnos/:id` | Actualiza campos sueltos |
| `DELETE` | `/api/turnos/:id` | Borra |
| `GET` | `/api/disponibilidad?fecha=YYYY-MM-DD&duracion=30` | Franjas libres del día |

### Ejemplos

```bash
# Crear
curl -X POST http://localhost:3000/api/turnos \
  -H "content-type: application/json" \
  -d '{"cliente":"Ana","servicio":"Corte","inicio":"2026-12-01T13:00:00.000Z","duracion_min":30}'

# Confirmar
curl -X PATCH http://localhost:3000/api/turnos/1 \
  -H "content-type: application/json" \
  -d '{"estado":"confirmado"}'

# Horarios libres
curl "http://localhost:3000/api/disponibilidad?fecha=2026-12-01&duracion=30"
```

### Códigos de respuesta

| Código | Cuándo |
|---|---|
| `201` | Turno creado (con header `Location`) |
| `204` | Borrado |
| `400` | Datos inválidos, con el detalle campo por campo |
| `404` | El turno no existe |
| `409` | Ese horario ya está ocupado |

Un `400` siempre devuelve el mismo formato, así el frontend no tiene que adivinar:

```json
{
  "error": "datos_invalidos",
  "detalles": [{ "campo": "inicio", "mensaje": "tiene que ser una fecha futura" }]
}
```

---

## Decisiones técnicas

**SQLite embebido en vez de Postgres.** El objetivo es que cualquiera clone el repo y lo corra con `npm install && npm start`, sin levantar un contenedor. `node:sqlite` viene con Node 22.5+, así que no hay dependencias nativas que compilar. En producción con varios procesos se cambia por Postgres; la capa de datos ya está aislada en `src/db.js`.

**Solapamiento resuelto en SQL, no en JavaScript.** Se guarda `inicio` y `fin` y se consulta `inicio < :fin AND :inicio < fin`. Traer todo y comparar en memoria funciona con 10 turnos y se cae con 10.000.

**Validación separada del ruteo.** `src/validar.js` no sabe nada de Express: recibe un objeto y devuelve errores. Eso permite testearla sola y reusarla desde un formulario.

**Tests contra un servidor real.** Cada test levanta la app en un puerto efímero y le pega por HTTP con `fetch`. Es más lento que mockear, pero prueba lo que el cliente va a usar de verdad: rutas, status codes y headers.

---

## Limitaciones (a sabiendas)

- **Sin autenticación.** En producción hace falta, mínimo un login por negocio y aislamiento de datos.
- **Un solo recurso por horario.** No hay "un turno por profesional": si el negocio tiene 3 peluqueros, hay que agregar una dimensión `profesional_id`.
- **Horario fijo 09:00–18:00** para la disponibilidad, en la hora local del servidor. Debería salir de la configuración del negocio.
- **Sin zona horaria explícita.** Se guarda UTC y se muestra en hora local del servidor. Si atiende clientes en otra zona, hay que fijar la del negocio.

---

## Estructura

```
src/
  app.js              arma Express, estáticos, 404 y manejo de errores
  server.js           escucha en el puerto y cierra ordenado
  db.js               esquema y conexión SQLite
  validar.js          reglas de validación, sin Express
  rutas/
    turnos.js         CRUD + detección de solapamientos
    disponibilidad.js franjas libres del día
public/
  index.html          interfaz mínima (vanilla JS, sin build)
test/
  api.test.js         13 tests end-to-end por HTTP
scripts/
  demo.js             carga datos de ejemplo
```

---

## Deploy

La app está preparada para correr en un hosting que inyecte `PORT`:

| Variable | Para qué | Por defecto |
|---|---|---|
| `PORT` | Lo asigna el hosting | `3000` |
| `DB` | Ruta del archivo SQLite | `data/turnos.db` |
| `SEED_DEMO` | Carga 4 turnos si la base está vacía | `true` |

El `render.yaml` incluido despliega en [Render](https://render.com) con el plan gratis:

1. Subir el repo a GitHub.
2. En Render: **New → Blueprint**, elegir el repo. Detecta `render.yaml` solo.
3. Cuando termina el build, abrir la URL y verificar `/api/salud`.

**Si cargás el repo por URL pública** (sin conectar la cuenta de GitHub), Render no recibe el webhook de los `push`: hay que entrar al servicio y usar **Manual Deploy → Deploy latest commit** después de cada cambio. Conectando la cuenta de GitHub en su lugar, el deploy pasa a ser automático.

**Cosas que hay que saber del plan gratis:**

- **El disco es efímero.** Cada deploy o reinicio borra `data/turnos.db`. Por eso `SEED_DEMO` vuelve a cargar los 4 turnos de ejemplo: sin eso, el que abre el link encuentra una pantalla vacía y cree que está roto. En producción real esto se resuelve con un disco persistente (pago) o Postgres.
- **Duerme a los 15 minutos sin tráfico.** La primera visita después tarda 30-50 segundos. Si molesta, se puede pingear `/api/salud` cada 10 minutos con un cron externo (cron-job.org).
- **Una sola instancia.** Render no escala horizontal en el plan gratis, y eso acá es una ventaja: SQLite con varias instancias daría datos inconsistentes porque cada una tendría su propio archivo.

**Tip:** no uses Vercel para esto. Serverless levanta varias instancias y cada una con su SQLite: el turno que creaste en una no aparece en la otra.
