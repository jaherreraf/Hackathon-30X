## Texto (chat/correo)

Mensajes de chat y correo para probar el flujo de texto (canal alternativo a PDF/imagen).

Ubicación: `samples/texto/`. Cada archivo `.md` contiene:
- El texto exacto a pegar en `/facturas` → tab "Texto".
- El resultado esperado.
- La explicación de por qué el motor decide eso.

> ⚠️ **Los resultados esperados dependen de que las reglas del sistema estén configuradas con los valores exactos indicados abajo.** Si cambiás los límites, el presupuesto, el umbral humano o la lista de beneficiarios, **algunas facturas pueden cambiar de decisión**. Antes de probar, verificá en `/reglas` que los valores coincidan.

### Configuración de reglas requerida

| Parámetro | Valor |
|---|---|
| Límite por pago | **$2.500** |
| Aprobación humana desde | **$1.500** |
| Presupuesto del periodo | **$6.000** |
| Monedas permitidas | **USD, EUR** |
| Tolerancia de monto | **$0** |
| Ventana de duplicados | **30 días** |
| Confianza mínima | **0.7** |
| Beneficiarios activos | Diseños Lumen ($800), CloudHost ($1.200), Ana Pérez ($2.500) |

Si tus reglas no coinciden, **el seed del backend las carga por defecto**:
```bash
cd backend && python seed.py
