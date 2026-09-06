"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { amountInWords, invoiceTotals, lineTotal } from "@/lib/invoice";
import type {
  Client,
  Invoice,
  InvoiceItem,
  Project,
  WorkspaceSettings,
} from "@/lib/types";

const NUMBER = new Intl.NumberFormat("fr-DZ", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const da = (n: number) => `${NUMBER.format(n)} DA`;

const frDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-DZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

/**
 * The document a client is handed. Deliberately plain and light-only: it is
 * printed on white paper, so it does not follow the app's theme.
 */
export function InvoiceDocument({
  invoice,
  items,
  settings,
  client,
  project,
}: {
  invoice: Invoice;
  items: InvoiceItem[];
  settings: WorkspaceSettings | null;
  client: Client | null;
  project: Project | null;
}) {
  const { subtotal, tax, total } = invoiceTotals(items, invoice.tax_rate);
  const isReceipt = invoice.kind === "receipt";

  const identity = [
    settings?.rc ? `RC : ${settings.rc}` : null,
    settings?.nif ? `NIF : ${settings.nif}` : null,
    settings?.nis ? `NIS : ${settings.nis}` : null,
    settings?.art ? `ART : ${settings.art}` : null,
  ].filter(Boolean);

  return (
    <div className="sheet-root">
      <style>{`
        .sheet-root {
          --ink: #14110c;
          --muted: #6b6459;
          --rule: #d9d2c6;
          background: #eeeae2;
          min-height: 100vh;
          padding: 24px 16px 64px;
          color: var(--ink);
          font-family: var(--font-inter), system-ui, sans-serif;
        }
        .bar {
          max-width: 210mm;
          margin: 0 auto 16px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .bar a, .bar button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 34px;
          padding: 0 12px;
          border-radius: 8px;
          border: 1px solid var(--rule);
          background: #fff;
          color: var(--ink);
          font-size: 13px;
          cursor: pointer;
        }
        .bar .go { background: var(--ink); color: #fff; border-color: var(--ink); }
        .sheet {
          max-width: 210mm;
          margin: 0 auto;
          background: #fff;
          padding: 18mm 16mm;
          box-shadow: 0 8px 30px rgba(20, 17, 12, .12);
          font-size: 12px;
          line-height: 1.5;
        }
        .sheet h1 { font-size: 26px; letter-spacing: .04em; margin: 0; }
        .muted { color: var(--muted); }
        .rule { border: 0; border-top: 1px solid var(--rule); margin: 14px 0; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 7px 8px; }
        thead th {
          text-align: left;
          font-size: 10.5px;
          text-transform: uppercase;
          letter-spacing: .08em;
          color: var(--muted);
          border-bottom: 1px solid var(--ink);
        }
        tbody td { border-bottom: 1px solid var(--rule); vertical-align: top; }
        .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }

        @page { size: A4; margin: 12mm; }
        @media print {
          .sheet-root { background: #fff; padding: 0; }
          .bar { display: none; }
          .sheet { box-shadow: none; max-width: none; margin: 0; padding: 0; }
          tr { break-inside: avoid; }
        }
      `}</style>

      <div className="bar">
        <Link href="/invoices">
          <ArrowLeft size={14} />
          Back to invoices
        </Link>
        <button className="go" onClick={() => window.print()}>
          <Printer size={14} />
          Print or save as PDF
        </button>
      </div>

      <div className="sheet">
        {/* ------------------------------------------------------- header */}
        <div style={{ display: "flex", gap: 24, justifyContent: "space-between" }}>
          <div style={{ maxWidth: "58%" }}>
            <p style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>
              {settings?.legal_name || "Votre société"}
            </p>
            {settings?.tagline ? (
              <p className="muted" style={{ margin: "2px 0 0" }}>
                {settings.tagline}
              </p>
            ) : null}
            <p className="muted" style={{ margin: "8px 0 0", whiteSpace: "pre-line" }}>
              {[settings?.address, settings?.phone, settings?.email, settings?.website]
                .filter(Boolean)
                .join("\n")}
            </p>
            {identity.length > 0 ? (
              <p className="muted" style={{ margin: "8px 0 0" }}>
                {identity.join(" · ")}
              </p>
            ) : null}
          </div>

          <div style={{ textAlign: "right" }}>
            <h1>{isReceipt ? "REÇU" : "FACTURE"}</h1>
            <p style={{ margin: "6px 0 0", fontSize: 14, fontWeight: 600 }}>
              {invoice.number}
            </p>
            <p className="muted" style={{ margin: "8px 0 0" }}>
              Date : {frDate(invoice.issued_on)}
            </p>
            {invoice.due_on ? (
              <p className="muted" style={{ margin: 0 }}>
                Échéance : {frDate(invoice.due_on)}
              </p>
            ) : null}
            {invoice.paid_on ? (
              <p className="muted" style={{ margin: 0 }}>
                Payée le : {frDate(invoice.paid_on)}
              </p>
            ) : null}
          </div>
        </div>

        <hr className="rule" />

        {/* --------------------------------------------------- the client */}
        <div style={{ display: "flex", gap: 24, justifyContent: "space-between" }}>
          <div>
            <p
              className="muted"
              style={{ margin: 0, fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".08em" }}
            >
              Client
            </p>
            <p style={{ margin: "4px 0 0", fontWeight: 600 }}>
              {client?.company || client?.name || "—"}
            </p>
            <p className="muted" style={{ margin: 0, whiteSpace: "pre-line" }}>
              {[
                client?.company ? client?.name : null,
                client?.address,
                client?.country,
                client?.phone,
                client?.email,
              ]
                .filter(Boolean)
                .join("\n")}
            </p>
          </div>

          {project ? (
            <div style={{ textAlign: "right" }}>
              <p
                className="muted"
                style={{ margin: 0, fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".08em" }}
              >
                Objet
              </p>
              <p style={{ margin: "4px 0 0" }}>{project.name}</p>
            </div>
          ) : null}
        </div>

        <hr className="rule" />

        {/* ---------------------------------------------------- the lines */}
        <table>
          <thead>
            <tr>
              <th>Désignation</th>
              <th className="num" style={{ width: "12%" }}>Qté</th>
              <th className="num" style={{ width: "20%" }}>P.U. HT</th>
              <th className="num" style={{ width: "22%" }}>Montant HT</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted" style={{ padding: "18px 8px" }}>
                  Aucune ligne sur ce document.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td style={{ whiteSpace: "pre-line" }}>{item.description}</td>
                  <td className="num">{item.quantity}</td>
                  <td className="num">{da(item.unit_price)}</td>
                  <td className="num">{da(lineTotal(item))}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* --------------------------------------------------- the totals */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <table style={{ width: "58%" }}>
            <tbody>
              <tr>
                <td className="muted">Total HT</td>
                <td className="num">{da(subtotal)}</td>
              </tr>
              <tr>
                <td className="muted">TVA {invoice.tax_rate}%</td>
                <td className="num">{da(tax)}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600, borderTop: "1px solid var(--ink)" }}>
                  Total TTC
                </td>
                <td
                  className="num"
                  style={{ fontWeight: 600, fontSize: 15, borderTop: "1px solid var(--ink)" }}
                >
                  {da(total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p style={{ marginTop: 14 }}>
          {isReceipt ? "Reçu la somme de" : "Arrêtée la présente facture à la somme de"}{" "}
          <strong>{amountInWords(total)}</strong>.
        </p>

        {/* ---------------------------------------------------- the feet */}
        {invoice.notes ? (
          <>
            <hr className="rule" />
            <p style={{ margin: 0, whiteSpace: "pre-line" }}>{invoice.notes}</p>
          </>
        ) : null}

        {settings?.bank_details || settings?.invoice_note ? (
          <>
            <hr className="rule" />
            <div style={{ display: "flex", gap: 24, justifyContent: "space-between" }}>
              {settings?.bank_details ? (
                <div>
                  <p
                    className="muted"
                    style={{ margin: 0, fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".08em" }}
                  >
                    Règlement
                  </p>
                  <p style={{ margin: "4px 0 0", whiteSpace: "pre-line" }}>
                    {settings.bank_details}
                  </p>
                </div>
              ) : null}
              <div style={{ textAlign: "right", minWidth: 180 }}>
                <p className="muted" style={{ margin: 0 }}>
                  Cachet et signature
                </p>
                <div
                  style={{
                    marginTop: 34,
                    borderTop: "1px solid var(--rule)",
                    width: 180,
                    marginLeft: "auto",
                  }}
                />
              </div>
            </div>
          </>
        ) : null}

        {settings?.invoice_note ? (
          <p className="muted" style={{ marginTop: 16, whiteSpace: "pre-line" }}>
            {settings.invoice_note}
          </p>
        ) : null}
      </div>
    </div>
  );
}
