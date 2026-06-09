import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const BRAND = "#1f4d3a";

const styles = StyleSheet.create({
  page: { paddingTop: 0, paddingBottom: 40, paddingHorizontal: 0, fontSize: 9, color: "#171717", fontFamily: "Helvetica" },

  headerBar: { flexDirection: "row", borderBottomWidth: 3, borderBottomColor: BRAND, alignItems: "stretch" },
  headerLeft: { flexDirection: "row", alignItems: "center", paddingHorizontal: 28, paddingVertical: 18, flex: 1, gap: 10 },
  logo: { width: 36, height: 36, backgroundColor: BRAND, color: "#fff", textAlign: "center", paddingTop: 8, fontSize: 16, fontFamily: "Helvetica-Bold" },
  brandSmall: { fontSize: 7, letterSpacing: 2, color: "#737373", textTransform: "uppercase" },
  brandTitle: { fontSize: 15, color: BRAND, fontFamily: "Helvetica-Bold", marginTop: 2 },
  headerRight: { paddingHorizontal: 28, paddingVertical: 18, borderLeftWidth: 1, borderLeftColor: "#e5e5e5", textAlign: "right", width: 190 },
  metaLabel: { fontSize: 7, color: "#737373", textTransform: "uppercase", letterSpacing: 1 },
  metaValue: { fontSize: 9, marginTop: 2, marginBottom: 4 },

  intro: { paddingHorizontal: 28, paddingTop: 14, paddingBottom: 6, fontSize: 9, color: "#525252", lineHeight: 1.45 },

  body: { paddingHorizontal: 28, paddingTop: 4 },
  thead: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BRAND, paddingVertical: 5 },
  th: { fontSize: 7, color: "#525252", textTransform: "uppercase", letterSpacing: 0.8, fontFamily: "Helvetica-Bold" },
  tr: { flexDirection: "row", paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: "#ededed", alignItems: "center" },
  trAlt: { backgroundColor: "#fafafa" },
  td: { fontSize: 9, color: "#262626" },

  cNum: { width: "6%", paddingRight: 4, color: "#a3a3a3" },
  cName: { width: "34%", paddingRight: 6 },
  cDate: { width: "26%", paddingRight: 6 },
  cEvent: { width: "34%", paddingRight: 2 },

  empty: { paddingHorizontal: 28, paddingTop: 24, fontSize: 10, color: "#737373", textAlign: "center" },

  footer: { position: "absolute", bottom: 18, left: 28, right: 28, borderTopWidth: 0.5, borderTopColor: "#e5e5e5", paddingTop: 8, fontSize: 7, color: "#a3a3a3", flexDirection: "row", justifyContent: "space-between" },
});

export interface RegistrationPdfRow {
  fullName: string;
  registeredAt: string; // ya formateada
  eventTitle: string;
}

export interface EventRegistrationsPdfDocProps {
  rows: RegistrationPdfRow[];
  title: string;
  subtitle?: string;
  dateLabel: string;
}

export function EventRegistrationsPdfDoc({ rows, title, subtitle, dateLabel }: EventRegistrationsPdfDocProps) {
  return (
    <Document title={`Salgon · ${title}`} author="Salgon Real Estate">
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.headerBar} fixed>
          <View style={styles.headerLeft}>
            <Text style={styles.logo}>S</Text>
            <View>
              <Text style={styles.brandSmall}>Salgon Real Estate</Text>
              <Text style={styles.brandTitle}>{title}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.metaLabel}>Fecha de emisión</Text>
            <Text style={styles.metaValue}>{dateLabel}</Text>
            <Text style={styles.metaLabel}>Total inscritos</Text>
            <Text style={styles.metaValue}>{rows.length}</Text>
          </View>
        </View>

        {subtitle && <Text style={styles.intro}>{subtitle}</Text>}

        {rows.length === 0 ? (
          <Text style={styles.empty}>No hay inscritos para los filtros seleccionados.</Text>
        ) : (
          <View style={styles.body}>
            <View style={styles.thead} fixed>
              <Text style={[styles.th, styles.cNum]}>#</Text>
              <Text style={[styles.th, styles.cName]}>Nombre completo</Text>
              <Text style={[styles.th, styles.cDate]}>Fecha y hora de registro</Text>
              <Text style={[styles.th, styles.cEvent]}>Evento</Text>
            </View>
            {rows.map((r, i) => (
              <View key={i} style={[styles.tr, i % 2 ? styles.trAlt : {}]} wrap={false}>
                <Text style={[styles.td, styles.cNum]}>{i + 1}</Text>
                <Text style={[styles.td, styles.cName]}>{r.fullName}</Text>
                <Text style={[styles.td, styles.cDate]}>{r.registeredAt}</Text>
                <Text style={[styles.td, styles.cEvent]}>{r.eventTitle}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text>Salgon Real Estate · Inscritos a eventos</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
