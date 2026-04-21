export type PropertyStatus = "Available" | "Reserved" | "Sold";
export type LeadStatus = "New" | "Contacted" | "Visit" | "Negotiation" | "Closed";
export type UserRole = "Admin" | "Agent";

export interface Agent {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  avatar?: string;
  propertiesAssigned: number;
  leadsAssigned: number;
}

export interface Property {
  id: string;
  title: string;
  price: number;
  location: string;
  status: PropertyStatus;
  agentId: string;
  bedrooms: number;
  bathrooms: number;
  area: number;
  image: string;
  createdAt: string;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  interest: string;
  budget: number;
  source: "Website" | "WhatsApp" | "Referral" | "Walk-in" | "Facebook";
  status: LeadStatus;
  agentId: string;
  createdAt: string;
}

export interface Appointment {
  id: string;
  leadId: string;
  propertyId: string;
  date: string; // ISO
  notes: string;
}

export interface ActivityItem {
  id: string;
  type: "lead" | "property" | "appointment" | "sale";
  message: string;
  time: string;
}

export const agents: Agent[] = [
  { id: "U-001", name: "Layla Haddad", email: "layla@salgon.com", phone: "+52 55 1100 2200", role: "Admin", propertiesAssigned: 12, leadsAssigned: 24 },
  { id: "U-002", name: "Omar Khalil", email: "omar@salgon.com", phone: "+52 55 3300 4400", role: "Agent", propertiesAssigned: 18, leadsAssigned: 31 },
  { id: "U-003", name: "Nour Saab", email: "nour@salgon.com", phone: "+52 55 5500 6600", role: "Agent", propertiesAssigned: 9, leadsAssigned: 17 },
  { id: "U-004", name: "Karim Aoun", email: "karim@salgon.com", phone: "+52 55 7700 8800", role: "Agent", propertiesAssigned: 14, leadsAssigned: 22 },
  { id: "U-005", name: "Sara Mansour", email: "sara@salgon.com", phone: "+52 55 9900 0011", role: "Agent", propertiesAssigned: 7, leadsAssigned: 11 },
];

export const properties: Property[] = [
  { id: "P-1024", title: "Penthouse Vista al Mar", price: 12500000, location: "CDMX, Polanco", status: "Available", agentId: "U-002", bedrooms: 4, bathrooms: 3, area: 280, image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800", createdAt: "2025-03-12" },
  { id: "P-1025", title: "Loft Moderno Centro", price: 5800000, location: "CDMX, Roma Norte", status: "Reserved", agentId: "U-003", bedrooms: 2, bathrooms: 2, area: 140, image: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800", createdAt: "2025-03-15" },
  { id: "P-1026", title: "Villa de Montaña Valle de Bravo", price: 17500000, location: "Valle de Bravo, Edo. Méx.", status: "Available", agentId: "U-004", bedrooms: 5, bathrooms: 4, area: 420, image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800", createdAt: "2025-02-28" },
  { id: "P-1027", title: "Departamento Familiar Coyoacán", price: 4450000, location: "CDMX, Coyoacán", status: "Sold", agentId: "U-002", bedrooms: 3, bathrooms: 2, area: 175, image: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800", createdAt: "2025-02-14" },
  { id: "P-1028", title: "Casa Frente al Mar Playa del Carmen", price: 7400000, location: "Playa del Carmen, Q. Roo", status: "Available", agentId: "U-005", bedrooms: 3, bathrooms: 2, area: 160, image: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800", createdAt: "2025-04-01" },
  { id: "P-1029", title: "Estudio Acogedor Condesa", price: 2450000, location: "CDMX, Condesa", status: "Reserved", agentId: "U-003", bedrooms: 1, bathrooms: 1, area: 65, image: "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800", createdAt: "2025-03-20" },
  { id: "P-1030", title: "Townhouse con Jardín Lomas", price: 9500000, location: "CDMX, Lomas de Chapultepec", status: "Available", agentId: "U-004", bedrooms: 4, bathrooms: 3, area: 310, image: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800", createdAt: "2025-04-05" },
  { id: "P-1031", title: "Penthouse con Terraza Del Valle", price: 6800000, location: "CDMX, Del Valle", status: "Sold", agentId: "U-002", bedrooms: 2, bathrooms: 2, area: 130, image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800", createdAt: "2025-01-22" },
];

export const leads: Lead[] = [
  { id: "L-2001", name: "Ramiro Domínguez", phone: "+52 55 1234 5678", email: "ramiro@ejemplo.com", interest: "Departamento en Condesa", budget: 3500000, source: "Website", status: "New", agentId: "U-002", createdAt: "2025-04-10" },
  { id: "L-2002", name: "Mariana Tovar", phone: "+52 55 2345 6789", email: "mariana@ejemplo.com", interest: "Villa en Valle de Bravo", budget: 16000000, source: "WhatsApp", status: "Contacted", agentId: "U-004", createdAt: "2025-04-08" },
  { id: "L-2003", name: "Elías Carvajal", phone: "+52 55 3456 7890", email: "elias@ejemplo.com", interest: "Loft en Roma Norte", budget: 6200000, source: "Referral", status: "Visit", agentId: "U-003", createdAt: "2025-04-05" },
  { id: "L-2004", name: "Zaira Rivera", phone: "+52 55 4567 8901", email: "zaira@ejemplo.com", interest: "Penthouse en Polanco", budget: 12500000, source: "Facebook", status: "Negotiation", agentId: "U-002", createdAt: "2025-04-02" },
  { id: "L-2005", name: "Hugo Navarro", phone: "+52 55 5678 9012", email: "hugo@ejemplo.com", interest: "Casa en Playa del Carmen", budget: 7500000, source: "Walk-in", status: "Closed", agentId: "U-005", createdAt: "2025-03-28" },
  { id: "L-2006", name: "Lorena Hernández", phone: "+52 55 6789 0123", email: "lorena@ejemplo.com", interest: "Estudio en Condesa", budget: 2500000, source: "Website", status: "New", agentId: "U-003", createdAt: "2025-04-12" },
  { id: "L-2007", name: "Toño Aburto", phone: "+52 55 7890 1234", email: "tono@ejemplo.com", interest: "Townhouse en Lomas", budget: 9700000, source: "WhatsApp", status: "Contacted", agentId: "U-004", createdAt: "2025-04-11" },
  { id: "L-2008", name: "Nadia Solís", phone: "+52 55 8901 2345", email: "nadia@ejemplo.com", interest: "Departamento familiar Coyoacán", budget: 4600000, source: "Referral", status: "Visit", agentId: "U-002", createdAt: "2025-04-09" },
];

const todayAt = (h: number, m: number) => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  // Local ISO without timezone suffix so `new Date(...)` parses as local time.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(h)}:${pad(m)}:00`;
};

export const appointments: Appointment[] = [
  { id: "A-3000", leadId: "L-2001", propertyId: "P-1023", date: todayAt(10, 30), notes: "Visita guiada modelo muestra" },
  { id: "A-3006", leadId: "L-2005", propertyId: "P-1028", date: todayAt(16, 0), notes: "Cierre de oferta" },
  { id: "A-3001", leadId: "L-2003", propertyId: "P-1025", date: "2025-04-22T10:00:00", notes: "Primera visita, llevar folleto" },
  { id: "A-3002", leadId: "L-2002", propertyId: "P-1026", date: "2025-04-22T14:30:00", notes: "Revisar opciones de financiamiento" },
  { id: "A-3003", leadId: "L-2004", propertyId: "P-1024", date: "2025-04-23T11:00:00", notes: "Reunión de negociación" },
  { id: "A-3004", leadId: "L-2008", propertyId: "P-1027", date: "2025-04-24T16:00:00", notes: "Visita familiar" },
  { id: "A-3005", leadId: "L-2007", propertyId: "P-1030", date: "2025-04-25T09:30:00", notes: "Recorrido inicial" },
];

export const activity: ActivityItem[] = [
  { id: "act-1", type: "lead", message: "Nuevo prospecto Rami Doumit asignado a Omar Khalil", time: "hace 5 min" },
  { id: "act-2", type: "property", message: "Propiedad P-1027 marcada como Vendida", time: "hace 1 hora" },
  { id: "act-3", type: "appointment", message: "Cita agendada con Maya Tabet", time: "hace 3 horas" },
  { id: "act-4", type: "sale", message: "Venta cerrada: P-1031 por Omar Khalil", time: "Ayer" },
  { id: "act-5", type: "lead", message: "Prospecto Zeina Rahal pasó a Negociación", time: "Ayer" },
  { id: "act-6", type: "property", message: "Nueva propiedad agregada: Chalet Frente al Mar Jbeil", time: "hace 2 días" },
];

export const monthlyStats = [
  { month: "Nov", leads: 42, sales: 6 },
  { month: "Dic", leads: 38, sales: 5 },
  { month: "Ene", leads: 51, sales: 8 },
  { month: "Feb", leads: 47, sales: 7 },
  { month: "Mar", leads: 63, sales: 11 },
  { month: "Abr", leads: 58, sales: 9 },
];

export const propertiesByStatus = [
  { status: "Available", count: properties.filter(p => p.status === "Available").length + 22 },
  { status: "Reserved", count: properties.filter(p => p.status === "Reserved").length + 8 },
  { status: "Sold", count: properties.filter(p => p.status === "Sold").length + 14 },
];

export const whatsappTemplates = [
  { id: "t1", name: "Bienvenida", body: "Hola {{name}}, gracias por contactar a Salgon Bienes Raíces. ¿En qué podemos ayudarte hoy?" },
  { id: "t2", name: "Propiedad Sugerida", body: "Hola {{name}}, encontramos una propiedad que coincide con tu interés: {{property}}. ¿Te gustaría agendar una visita?" },
  { id: "t3", name: "Confirmación de Visita", body: "Hola {{name}}, confirmamos tu visita a {{property}} el {{date}}. ¡Te esperamos!" },
  { id: "t4", name: "Seguimiento", body: "Hola {{name}}, queríamos dar seguimiento a nuestra última conversación. ¿Tienes alguna duda?" },
  { id: "t5", name: "Oferta Enviada", body: "Estimado(a) {{name}}, adjuntamos nuestra oferta oficial para {{property}}. Quedamos atentos a tus comentarios." },
];

export function fmtMoney(n: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(n) + " MXN";
}

export function fmtMXN(n: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(n) + " MXN";
}

// ============================================================
// GLOBAL AVAILABILITY (availability_master) — central source of
// truth, synced one-way to `properties` records via REST API.
// ============================================================

export type AvailabilityStatus = "Available" | "Reserved" | "Sold";

export interface AvailabilityHistoryEntry {
  at: string;                  // ISO datetime
  from: AvailabilityStatus;
  to: AvailabilityStatus;
  agentId: string;             // FK to agents.id
}

export interface AvailabilityRow {
  id: string;          // PK in availability_master
  model: string;       // FK group → property model
  lot: string;         // Lot Number
  cluster: string;     // Location / Cluster
  price: number;       // MXN
  delivery: string;    // ISO date or label
  status: AvailabilityStatus;
  notes: string;
  propertyId?: string; // FK to properties.id (sync target)
  updatedAt: string;
  history?: AvailabilityHistoryEntry[];
}

const today = new Date();
const iso = (d: Date) => d.toISOString().slice(0, 10);
const inMonths = (m: number) => {
  const d = new Date(today);
  d.setMonth(d.getMonth() + m);
  return iso(d);
};

const daysAgo = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

export const availabilityRows: AvailabilityRow[] = [
  // Tulipán
  { id: "AV-1001", model: "Tulipán",     lot: "L-04",  cluster: "Cluster Norte",  price: 2_850_000, delivery: inMonths(0), status: "Available", notes: "Entrega inmediata", propertyId: "P-1024", updatedAt: iso(today),
    history: [
      { at: daysAgo(45), from: "Available", to: "Reserved", agentId: "U-002" },
      { at: daysAgo(30), from: "Reserved",  to: "Available", agentId: "U-002" },
    ] },
  { id: "AV-1002", model: "Tulipán",     lot: "L-07",  cluster: "Cluster Norte",  price: 2_910_000, delivery: inMonths(2), status: "Reserved",  notes: "Apartado 30 días",  propertyId: "P-1025", updatedAt: iso(today),
    history: [
      { at: daysAgo(12), from: "Available", to: "Reserved", agentId: "U-003" },
    ] },
  { id: "AV-1003", model: "Tulipán",     lot: "L-12",  cluster: "Cluster Norte",  price: 2_980_000, delivery: inMonths(6), status: "Available", notes: "6 meses firma",     updatedAt: iso(today) },
  { id: "AV-1004", model: "Tulipán",     lot: "L-15",  cluster: "Cluster Norte",  price: 2_780_000, delivery: inMonths(0), status: "Sold",      notes: "Escriturado",       propertyId: "P-1027", updatedAt: iso(today),
    history: [
      { at: daysAgo(60), from: "Available", to: "Reserved", agentId: "U-002" },
      { at: daysAgo(40), from: "Reserved",  to: "Sold",     agentId: "U-002" },
    ] },

  // Nardo
  { id: "AV-2001", model: "Nardo",       lot: "L-02",  cluster: "Cluster Lago",   price: 3_450_000, delivery: inMonths(1), status: "Available", notes: "Entrega inmediata", propertyId: "P-1028", updatedAt: iso(today) },
  { id: "AV-2002", model: "Nardo",       lot: "L-09",  cluster: "Cluster Lago",   price: 3_490_000, delivery: inMonths(4), status: "Available", notes: "4 meses firma",     updatedAt: iso(today) },
  { id: "AV-2003", model: "Nardo",       lot: "L-14",  cluster: "Cluster Lago",   price: 3_520_000, delivery: inMonths(0), status: "Reserved",  notes: "Apartado 15 días",  updatedAt: iso(today),
    history: [
      { at: daysAgo(5), from: "Available", to: "Reserved", agentId: "U-005" },
    ] },

  // Bugambilia
  { id: "AV-3001", model: "Bugambilia",  lot: "L-01",  cluster: "Cluster Sur",    price: 4_180_000, delivery: inMonths(0), status: "Available", notes: "Entrega inmediata", propertyId: "P-1026", updatedAt: iso(today) },
  { id: "AV-3002", model: "Bugambilia",  lot: "L-06",  cluster: "Cluster Sur",    price: 4_220_000, delivery: inMonths(3), status: "Sold",      notes: "Crédito INFONAVIT", propertyId: "P-1031", updatedAt: iso(today),
    history: [
      { at: daysAgo(80), from: "Available", to: "Reserved", agentId: "U-004" },
      { at: daysAgo(50), from: "Reserved",  to: "Sold",     agentId: "U-004" },
    ] },
  { id: "AV-3003", model: "Bugambilia",  lot: "L-11",  cluster: "Cluster Sur",    price: 4_260_000, delivery: inMonths(8), status: "Available", notes: "8 meses firma",     updatedAt: iso(today) },
  { id: "AV-3004", model: "Bugambilia",  lot: "L-18",  cluster: "Cluster Sur",    price: 4_300_000, delivery: inMonths(8), status: "Available", notes: "8 meses firma",     updatedAt: iso(today) },

  // Jacaranda
  { id: "AV-4001", model: "Jacaranda",   lot: "L-03",  cluster: "Cluster Reserva",price: 5_650_000, delivery: inMonths(2), status: "Reserved",  notes: "Apartado 60 días",  propertyId: "P-1029", updatedAt: iso(today),
    history: [
      { at: daysAgo(20), from: "Available", to: "Reserved", agentId: "U-003" },
    ] },
  { id: "AV-4002", model: "Jacaranda",   lot: "L-08",  cluster: "Cluster Reserva",price: 5_720_000, delivery: inMonths(6), status: "Available", notes: "6 meses firma",     updatedAt: iso(today) },
  { id: "AV-4003", model: "Jacaranda",   lot: "L-17",  cluster: "Cluster Reserva",price: 5_790_000, delivery: inMonths(0), status: "Available", notes: "Entrega inmediata", propertyId: "P-1030", updatedAt: iso(today) },

  // Magnolia
  { id: "AV-5001", model: "Magnolia",    lot: "L-05",  cluster: "Cluster Bosque", price: 6_980_000, delivery: inMonths(10), status: "Available", notes: "10 meses firma",   updatedAt: iso(today) },
  { id: "AV-5002", model: "Magnolia",    lot: "L-13",  cluster: "Cluster Bosque", price: 7_050_000, delivery: inMonths(10), status: "Available", notes: "10 meses firma",   updatedAt: iso(today) },
];

