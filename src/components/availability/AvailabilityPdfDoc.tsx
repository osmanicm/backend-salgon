import {
  Document, Page, Text, View, StyleSheet,
} from "@react-pdf/renderer";
import { fmtMXN, type AvailabilityRow } from "@/data/mock";

const BRAND = "#1f4d3a";

const styles = StyleSheet.create({
  page: { paddingTop: 0, paddingBottom: 36, paddingHorizontal: 0, fontSize: 9, color: "#171717", fontFamily: "Helvetica" },

  // Header bar
  headerBar: { flexDirection: "row", borderBottomWidth: 3, borderBottomColor: BRAND, alignItems: "stretch" },
  headerLeft: { flexDirection: "row", alignItems: "center", paddingHorizontal: 28, paddingVertical: 18, flex: 1, gap: 10 },
  logo: { width: 36, height: 36, backgroundColor: BRAND, color: "#fff", textAlign: "center", paddingTop: 8, fontSize: 16, fontFamily: "Helvetica-Bold" },
  brandSmall: { fontSize: 7, letterSpacing: 2, color: "#737373", textTransform: "uppercase" },
  brandTitle: { fontSize: 15, color: BRAND, fontFamily: "Helvetica-Bold", marginTop: 2 },
  headerRight: { paddingHorizontal: 28, paddingVertical: 18, borderLeftWidth: 1, borderLeftColor: "#e5e5e5", textAlign: "right", width: 170 },
  metaLabel: { fontSize: 7, color: "#737373", textTransform: "uppercase", letterSpacing: 1 },
  metaValue: { fontSize: 9, marginTop: 2, marginBottom: 4 },
  metaMono: { fontSize: 9, fontFamily: "Courier", marginTop: 2 },

  intro: { paddingHorizontal: 28, paddingTop: 14, paddingBottom: 4, fontSize: 9, color: "#525252", lineHeight: 1.45 },

  body: { paddingHorizontal: 28, paddingTop: 8 },
  modelSection: { marginBottom: 14 },
  modelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", borderBottomWidth: 1.5, borderBottomColor: BRAND, paddingBottom: 3, marginBottom: 4 },
  modelTitle: { fontSize: 10, color: BRAND, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1 },
  modelCount: { fontSize: 7, color: "#737373", textTransform: "uppercase", letterSpacing: 1 },

  thead: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#d4d4d4", paddingVertical: 4 },
  th: { fontSize: 7, color: "#737373", textTransform: "uppercase", letterSpacing: 0.8, fontFamily: "Helvetica-Bold" },
  tr: { flexDirection: "row", paddingVertical: 4, alignItems: "center" },
  trAlt: { backgroundColor: "#fafafa" },
  td: { fontSize: 9, color: "#262626" },

  // Column widths (sum ≈ 100%)
  cLot:    { width: "10%", paddingRight: 6 },
  cClus:   { width: "22%", paddingRight: 6 },
  cPrice:  { width: "16%", paddingRight: 6, textAlign: "right" },
  cDel:    { width: "12%", paddingRight: 6 },
  cStat:   { width: "14%", paddingRight: 6 },
  cNotes:  { width: "26%" },

  badge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 2, fontSize: 7, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.6, alignSelf: "flex-start" },
  badgeAvail: { backgroundColor: "#d1fae5", color: "#065f46" },
  badgeRes:   { backgroundColor: "#fef3c7", color: "#78350f" },
  badgeSold:  { backgroundColor: "#ffe4e6", color: "#9f1239" },

  footer: { position: "absolute", bottom: 18, left: 28, right: 28, borderTopWidth: 0.5, borderTopColor: "#e5e5e5", paddingTop: 8, fontSize: 7, color: "#a3a3a3", lineHeight: 1.5 },
  footerNote: { fontSize: 7, color: "#737373", lineHeight: 1.5, marginBottom: 3 },
  footerStrong: { fontFamily: "Helvetica-Bold", color: "#404040" },
  footerRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4, paddingTop: 4, borderTopWidth: 0.5, borderTopColor: "#e5e5e5" },
});

const statusEs = (s: AvailabilityRow["status"]) =>
  s === "Available" ? "Disponible" : s === "Reserved" ? "Apartada" : "Vendida";

const statusBadge = (s: AvailabilityRow["status"]) =>
  s === "Available" ? styles.badgeAvail : s === "Reserved" ? styles.badgeRes : styles.badgeSold;

export interface AvailabilityPdfDocProps {
  groups: [string, AvailabilityRow[]][];
  folio: string;
  dateLabel: string;
}

export function AvailabilityPdfDoc({ groups, folio, dateLabel }: AvailabilityPdfDocProps) {
  const totalUnits = groups.reduce((s, [, items]) => s + items.length, 0);

  return (
    <Document title="Salgon · Reporte de Disponibilidad" author="Salgon Real Estate">
      <Page size="A4" style={styles.page} wrap>
        {/* Header */}
        <View style={styles.headerBar} fixed>
          <View style={styles.headerLeft}>
            <Text style={styles.logo}>S</Text>
            <View>
              <Text style={styles.brandSmall}>Salgon Real Estate</Text>
              <Text style={styles.brandTitle}>Reporte de Disponibilidad</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.metaLabel}>Fecha de emisión</Text>
            <Text style={styles.metaValue}>{dateLabel}</Text>
            <Text style={styles.metaLabel}>Folio</Text>
            <Text style={styles.metaMono}>{folio}</Text>
          </View>
        </View>

        <Text style={styles.intro}>
          Estimado cliente, a continuación se presenta la disponibilidad vigente de unidades en nuestros desarrollos.
          Precios expresados en pesos mexicanos (MXN) y sujetos a cambio sin previo aviso.
        </Text>

        <View style={styles.body}>
          {groups.map(([model, items]) => (
            <View key={model} style={styles.modelSection} wrap={false}>
              <View style={styles.modelHeader}>
                <Text style={styles.modelTitle}>Modelo {model}</Text>
                <Text style={styles.modelCount}>{items.length} unidades</Text>
              </View>

              <View style={styles.thead}>
                <Text style={[styles.th, styles.cLot]}>Lote</Text>
                <Text style={[styles.th, styles.cClus]}>Cluster</Text>
                <Text style={[styles.th, styles.cPrice]}>Precio MXN</Text>
                <Text style={[styles.th, styles.cDel]}>Entrega</Text>
                <Text style={[styles.th, styles.cStat]}>Estatus</Text>
                <Text style={[styles.th, styles.cNotes]}>Observaciones</Text>
              </View>

              {items.map((r, i) => (
                <View key={r.id} style={[styles.tr, i % 2 ? styles.trAlt : {}]}>
                  <Text style={[styles.td, styles.cLot, { fontFamily: "Courier" }]}>{r.lot}</Text>
                  <Text style={[styles.td, styles.cClus]}>{r.cluster}</Text>
                  <Text style={[styles.td, styles.cPrice, { fontFamily: "Helvetica-Bold" }]}>{fmtMXN(r.price)}</Text>
                  <Text style={[styles.td, styles.cDel]}>
                    {new Date(r.delivery).toLocaleDateString("es-MX", { month: "short", year: "numeric" })}
                  </Text>
                  <View style={styles.cStat}>
                    <Text style={[styles.badge, statusBadge(r.status)]}>{statusEs(r.status)}</Text>
                  </View>
                  <Text style={[styles.td, styles.cNotes, { color: "#525252" }]}>{r.notes}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerNote}>
            <Text style={styles.footerStrong}>Notas: </Text>
            "Entrega inmediata" no aplica a unidades en proceso de escrituración. "X meses firma" indica el plazo estimado de entrega a partir de la firma del contrato.
          </Text>
          <Text style={styles.footerNote}>
            Esta cotización tiene una vigencia de 15 días naturales. Reservaciones sujetas a disponibilidad y aprobación crediticia. Precios no incluyen gastos de escrituración, avalúo ni notariales.
          </Text>
          <View style={styles.footerRow}>
            <Text>Salgon Real Estate · Centralized Inventory · {totalUnits} unidades</Text>
            <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
          </View>
        </View>
      </Page>
    </Document>
  );
}
