# AP-99 — Ana Pérez — $5.000.000 COP

**Resultado esperado:** Escalar
**Regla que dispara:** `CURRENCY`

## Texto a pegar en /facturas → tab "Texto"

Hola, adjunto la cuenta de cobro AP-99 de Ana Pérez por consultoría tributaria por un total de 5000000 COP con vencimiento 2026-11-18. Enviado desde correo corporativo.

## Por qué

- Moneda **`COP`** no está en `allowed_currencies` (`["USD", "EUR"]`).
- No hay tasa de cambio configurada para COP.
- El motor **escala** sin intentar convertir.
