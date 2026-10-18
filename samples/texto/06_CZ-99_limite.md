# CZ-99 — Consultora Zeta — $3.500 USD

**Resultado esperado:** Escalar
**Reglas que disparan:** `BENEFICIARY`, `PAYMENT_LIMIT`, `HUMAN_APPROVAL`

## Texto a pegar en /facturas → tab "Texto"

Estimados, adjunto la factura CZ-99 de Consultora Zeta por el cierre de auditoría financiera por 3500 USD con vencimiento 2026-11-30.

## Por qué

- `Consultora Zeta` **no está en la lista** → `BENEFICIARY`.
- `$3.500 > $2.500` (límite por pago) → `PAYMENT_LIMIT`.
- `$3.500 ≥ $1.500` (umbral humano) → `HUMAN_APPROVAL`.
- **3 reglas fallan simultáneamente.** El motor evalúa todas y escala con las 3 razones.
