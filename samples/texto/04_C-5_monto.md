# C-5 — CloudHost — $1.900 USD

**Resultado esperado:** Escalar
**Reglas que disparan:** `AGREED_AMOUNT`, `HUMAN_APPROVAL`

## Texto a pegar en /facturas → tab "Texto"

Estimados, adjuntamos la factura C-5 de CloudHost por consumo adicional de servidores en la nube y base de datos gestionada por un valor de 1900 USD con fecha de vencimiento 2026-11-02.

## Por qué

- `CloudHost` está en la lista, pero su `agreed_amount` es **$1.200**.
- El monto **$1.900 ≠ $1.200** → `AGREED_AMOUNT`.
- `$1.900 ≥ $1.500` → `HUMAN_APPROVAL` (umbral humano).
- Escala con 2 razones.
