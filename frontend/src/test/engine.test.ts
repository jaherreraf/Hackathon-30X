import { describe, expect, it } from "vitest";
import { buildInvoices, defaultRules } from "@/data/mock";
import { computeMetrics } from "@/api";

const inv = buildInvoices(defaultRules);
const by = (id: string) => inv.find((i) => i.id === id)!;

describe("mock decisions follow company rules", () => {
  it("pays L-001 from Diseños Lumen", () => expect(by("inv-01").decision.decision).toBe("pagar"));
  it("pays CloudHost 1200", () => expect(by("inv-02").decision.decision).toBe("pagar"));
  it("blocks the duplicated L-001", () => {
    expect(by("inv-03").decision.decision).toBe("frenar");
    expect(by("inv-03").decision.reglas_aplicadas).toEqual(["DUPLICADO"]);
  });
  it("escalates unknown supplier", () => expect(by("inv-04").decision.reglas_aplicadas).toEqual(["BENEFICIARIO"]));
  it("escalates C-5 for agreed amount and human approval", () =>
    expect(by("inv-05").decision.reglas_aplicadas).toEqual(["MONTO_ACORDADO", "APROBACION_HUMANA"]));
  it("escalates Z-3 for the payment limit", () => expect(by("inv-06").decision.reglas_aplicadas).toEqual(["LIMITE_PAGO"]));
  it("escalates the invoice without number", () =>
    expect(by("inv-07").decision.reglas_aplicadas).toEqual(["DATOS_INCOMPLETOS"]));
  it("escalates COP invoice", () => expect(by("inv-08").decision.reglas_aplicadas).toEqual(["MONEDA"]));
  it("escalates A-7 for human approval", () =>
    expect(by("inv-09").decision.reglas_aplicadas).toEqual(["APROBACION_HUMANA"]));
  it("blocks the invoice over the remaining budget", () => {
    expect(by("inv-10").decision.decision).toBe("frenar");
    expect(by("inv-10").decision.reglas_aplicadas).toContain("PRESUPUESTO");
  });
  it("budget: 6000 total, 4500 spent", () => {
    const m = computeMetrics(inv, defaultRules);
    expect(m.presupuesto_gastado).toBe(4500);
    expect(m.presupuesto_disponible).toBe(1500);
    expect(m.pagos_fuera_de_reglas).toBe(0);
  });
});
