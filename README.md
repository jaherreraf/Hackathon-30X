# Blinka Agent

> 🏆 Submission for the **30X Hackathon**

Agente inteligente y determinista para la gestión, validación y pago autónomo de facturas empresariales.

---

## 📌 El Problema

El procesamiento manual de cuentas por pagar en las empresas es lento, costoso y altamente propenso a errores humanos y fraudes:
- **Facturas duplicadas o fraccionadas** para evadir límites de aprobación.
- **Cobros por encima de los montos acordados** con proveedores.
- **Riesgo de fraude o inyección de instrucciones (Prompt Injection)** cuando se confía ciegamente la decisión a modelos de lenguaje (LLMs).

## 💡 Nuestra Solución

**Blinka Agent** combina lo mejor de dos mundos:
1. **Extracción Multimodal con IA:** Utiliza **Google Gemini** exclusivamente como extractor de datos desde texto sin formato, documentos PDF o imágenes. El contenido de la factura siempre se trata como dato no confiable (*untrusted data*).
2. **Motor de Decisión Determinista (Zero-Hallucination):** La decisión de **Pagar (`pay`)**, **Frenar (`hold`)** o **Escalar a Humano (`escalate`)** es ejecutada por un motor en Python puro basado en 13 reglas de negocio estrictas. **Ante cualquier duda o error, escala; nunca paga.**
3. **Control Humano en el Ciclo (Human-in-the-Loop):** Las facturas escaladas pueden ser revisadas y resueltas por el equipo de finanzas con justificación auditada.
4. **Simulador de Políticas "What-If" (Read-Only):** Permite proyectar el impacto de nuevas reglas sobre facturas históricas en memoria antes de aplicarlas.
5. **Auditoría Unificada e Inmutable:** Trazabilidad completa de cada evento (`invoice_received` ➔ `data_extracted` ➔ `decision_made` ➔ `human_resolution`).

---

## 🛠️ Stack Tecnológico

### Backend
- **Framework:** FastAPI (Python 3.10+)
- **Base de Datos & ORM:** SQLAlchemy 2.0 + SQLite (compatible con PostgreSQL)
- **Modelos & Validación:** Pydantic v2
- **IA & Extracción:** Google GenAI SDK (`gemini-3.8-flash`)
- **Testing:** Pytest (23 tests automatizados con pruebas de propiedades)

### Frontend
- **Framework:** React 19 + TypeScript + Vite
- **UI & Componentes:** TailwindCSS + Radix UI + Lucide Icons
- **Enrutamiento & Estado:** TanStack Router + TanStack Query + Zustand

---

## 🚀 Cómo Ejecutar el Proyecto

### 1. Clonar el repositorio
```bash
git clone https://github.com/jaherreraf/Hackathon-30X.git
cd Hackathon-30X
```

### 2. Backend

```bash
cd backend

# Crear y activar entorno virtual
python -m venv venv
# En Windows:
.\venv\Scripts\activate
# En macOS/Linux:
# source venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt

# Configurar variables de entorno
# Crea un archivo .env en la carpeta backend con:
# GEMINI_API_KEY=tu_clave_de_gemini
# GEMINI_MODEL=gemini-3.8-flash

# Inicializar la base de datos limpia con reglas de demo
python seed.py --reset

# Iniciar servidor backend
uvicorn main:app --reload
```
* **API y Swagger Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
* **Health Check:** [http://localhost:8000/health](http://localhost:8000/health)

### 3. Frontend

En otra terminal:
```bash
cd frontend

# Instalar dependencias
pnpm install

# Iniciar servidor de desarrollo
pnpm dev
```
* **Aplicación Web:** [http://localhost:8081/](http://localhost:8081/)

---

## 🧪 Pruebas Automatizadas

Para correr la suite de pruebas del backend (23 tests pasando al 100%):

```bash
cd backend
python -m pytest tests/ -v
```

Incluye pruebas unitarias, pruebas de flujo API, validación de read-only del simulador y un test de propiedades con miles de facturas aleatorias garantizando que ninguna regla se viole.

---

## 📋 Reglas del Motor de Decisión

| Regla | Criterio | Decisión |
|---|---|---|
| `INCOMPLETE_DATA` | Faltan datos esenciales (número, beneficiario, monto, moneda) | `escalate` (corta) |
| `SUSPICIOUS_CONTENT` | Contenido con intento de inyección de prompt / bypass | `escalate` (corta) |
| `LOW_CONFIDENCE` | Confianza de extracción inferior al umbral mínimo | `escalate` (corta) |
| `CURRENCY` | Moneda no permitida o sin tasa de cambio disponible | `escalate` (corta) |
| `DUPLICATE` | Factura duplicada exacta o mismo monto al mismo proveedor en 30 días | `hold` |
| `BENEFICIARY` | Proveedor no registrado en la lista de beneficiarios activos | `escalate` |
| `AGREED_AMOUNT` | Monto diferente al acordado fuera de la tolerancia permitida | `escalate` |
| `PAYMENT_LIMIT` | Monto superior al límite individual por pago | `escalate` |
| `HUMAN_APPROVAL` | Monto igual o superior al umbral que requiere aprobación humana | `escalate` |
| `BENEFICIARY_LIMIT` | Supera el límite de presupuesto asignado a ese proveedor en el periodo | `hold` |
| `BUDGET` | El pago superaría el presupuesto total disponible de la empresa | `hold` |
| `OVERDUE` | Factura vencida o sin fecha de vencimiento | `escalate` |
| `SPLIT_PAYMENTS` | Facturas consecutivas recientes que sugieren fraccionamiento de pagos | `escalate` |

---

## 👥 Equipo

Desarrollado para el **30X Hackathon**.
