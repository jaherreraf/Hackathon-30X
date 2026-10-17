# Blinka Agent – Backend

Agente que lee facturas (texto, PDF o imagen) y decide **pagar, frenar o escalar** según las reglas de la empresa.

**Principio de diseño:** el LLM (Gemini) solo *extrae* los datos de la factura. La decisión la toma un motor determinista en Python (`features/decisions/engine.py`), sin base de datos y sin IA. Ante cualquier duda o error, **escala; nunca paga**.

## Cómo correrlo

Requisitos: Python 3.10 o superior.

Desde la carpeta del backend (donde está `main.py`):

```bash
python -m venv venv
venv\Scripts\activate            # Windows  (macOS/Linux: source venv/bin/activate)
pip install -r requirements.txt
```

Crea un archivo `.env` (no se sube al repo):

```
GEMINI_API_KEY=tu_clave
GEMINI_MODEL=gemini-3.8-flash
# EXTRACTOR=stub    # solo para pruebas sin Gemini: el texto se envía como JSON
```

Carga los datos de demo y levanta el servidor:

```bash
python seed.py            # regla activa de Acme Corp y 3 beneficiarios (se puede repetir)
python seed.py --reset    # BORRA todas las tablas y las recrea (detén uvicorn antes)
uvicorn main:app --reload
```

Documentación interactiva: http://localhost:8000/docs

Pruebas:

```bash
python -m pytest tests/ -v
```

## Endpoints

| Método y ruta | Qué hace |
|---|---|
| `GET /rules` · `PUT /rules` | Lee la regla activa / la reemplaza (la anterior se conserva como historial) |
| `GET /beneficiaries` · `POST /beneficiaries` · `PUT /beneficiaries/{id}` | Lista de proveedores permitidos |
| `POST /invoices` | Procesa una factura (`source` = `text`, `pdf` o `image`) |
| `GET /invoices` · `GET /invoices/{id}` | Lista (filtro `?status=`) y detalle con la decisión explicada |
| `POST /decisions/{id}/resolve` | Un humano aprueba o rechaza una factura **escalada** |
| `POST /simulator` | Re-evalúa las facturas con reglas hipotéticas, **sin guardar nada** |
| `GET /audit` | Registro de auditoría (filtros `event`, `entity`, `entity_id`) |
| `GET /metrics` | Conteos, autonomía (0 a 1), presupuesto y `payments_outside_rules` |

## Las reglas del motor

Resultado final: **PAGAR** solo si todas las reglas pasan; si alguna dice FRENAR, se **frena**; si no, y alguna dice ESCALAR, se **escala**. Cualquier error interno escala.

Las cuatro primeras cortan la evaluación; el resto se evalúan todas para dejar el registro completo.

| Regla | Falla cuando… | Efecto |
|---|---|---|
| `INCOMPLETE_DATA` | falta número, beneficiario, monto o moneda | escalar (corta) |
| `SUSPICIOUS_CONTENT` | la factura contiene instrucciones dirigidas al agente | escalar (corta) |
| `LOW_CONFIDENCE` | la confianza de la extracción es menor al mínimo | escalar (corta) |
| `CURRENCY` | la moneda no está permitida o no tiene tasa de cambio | escalar (corta) |
| `DUPLICATE` | mismo proveedor y número, o mismo monto en la ventana de días | frenar |
| `BENEFICIARY` | el proveedor no está en la lista de beneficiarios activos | escalar |
| `AGREED_AMOUNT` | el monto difiere del acordado más allá de la tolerancia | escalar |
| `PAYMENT_LIMIT` | el monto supera el límite por pago | escalar |
| `HUMAN_APPROVAL` | el monto alcanza el umbral de aprobación humana | escalar |
| `BENEFICIARY_LIMIT` | lo ya pagado al proveedor más esta factura supera su límite del periodo | frenar |
| `BUDGET` | el gasto del periodo más esta factura supera el presupuesto | frenar |
| `OVERDUE` | la factura está vencida o no tiene fecha de vencimiento | escalar |
| `SPLIT_PAYMENTS` | facturas recientes del proveedor sumadas superan el umbral humano (posible fraccionamiento) | escalar |

## Estados de una factura

`paid` · `held` · `escalated` (pendiente de revisión) · `approved_human` · `rejected_human`

Una factura frenada (`held`) o ya pagada **no se puede resolver** por `/decisions/{id}/resolve`: solo las escaladas pendientes.

## Seguridad

- **Inyección de prompts.** El contenido de la factura se trata como dato no confiable. Hay dos capas: Gemini marca `suspicious` y, además, una expresión regular en Python revisa el texto. Una factura sospechosa siempre se escala.
- **Auditoría de solo inserción.** Cada evento (recepción, extracción, decisión, resolución humana, cambio de reglas) queda registrado, y cada decisión guarda un *snapshot* de las reglas vigentes.
- **Simulador de solo lectura.** No escribe en la base de datos.
- **Transacciones.** Factura, decisión y auditoría se guardan en una sola transacción: si algo falla, no queda nada a medias.
- **Pruebas.** El motor tiene una suite de pruebas por caso y una prueba de propiedad con miles de facturas aleatorias que verifica que **ningún pago viola una regla**.
