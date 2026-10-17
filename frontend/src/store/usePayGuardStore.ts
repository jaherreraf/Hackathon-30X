import { create } from "zustand";
import { buildAudit, buildInvoices, defaultRules } from "@/data/mock";
import type { AuditEvent, InvoiceItem, Rules } from "@/types";

interface PayGuardState {
  rules: Rules;
  invoices: InvoiceItem[];
  audit: AuditEvent[];
  setRules: (r: Rules) => void;
  addInvoice: (i: InvoiceItem) => void;
  updateInvoice: (i: InvoiceItem) => void;
  addAudit: (e: AuditEvent) => void;
}

const initialInvoices = buildInvoices(defaultRules);

export const usePayGuardStore = create<PayGuardState>((set) => ({
  rules: defaultRules,
  invoices: initialInvoices,
  audit: buildAudit(initialInvoices),
  setRules: (rules) => set({ rules }),
  addInvoice: (i) => set((s) => ({ invoices: [...s.invoices, i] })),
  updateInvoice: (i) => set((s) => ({ invoices: s.invoices.map((x) => (x.id === i.id ? i : x)) })),
  addAudit: (e) => set((s) => ({ audit: [e, ...s.audit] })),
}));
