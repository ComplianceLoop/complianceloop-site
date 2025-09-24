import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  portalSlug: text("portal_slug").notNull().unique(),
  portalSecret: text("portal_secret").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const providers = pgTable("providers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  serviceArea: text("service_area"),
  availabilitySource: text("availability_source").default("unknown").notNull(),
  weeklyHoursJson: text("weekly_hours_json"),
  maxJobsPerDay: integer("max_jobs_per_day").default(3),
  notificationEmailPrimary: text("notification_email_primary"),
  notificationEmailCc: text("notification_email_cc"),
  techDefaultEmail: text("tech_default_email"),
  rushOptIn: boolean("rush_opt_in").default(false),
  assignmentScore: integer("assignment_score").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const providerBlocks = pgTable("provider_blocks", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id").notNull(),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull()
});

export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  providerId: integer("provider_id"),
  title: text("title").notNull(),
  address: text("address"),
  startAt: timestamp("start_at"),
  endAt: timestamp("end_at"),
  status: text("status").default("UPCOMING").notNull(),
  notes: text("notes"),
  technicianName: text("technician_name"),
  technicianEmail: text("technician_email"),
  technicianPhone: text("technician_phone"),
  autoAssigned: boolean("auto_assigned").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const jobAssets = pgTable("job_assets", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull(),
  type: text("type").notNull(),
  r2Key: text("r2_key").notNull(),
  contentType: text("content_type"),
  bytes: integer("bytes").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const loginCodes = pgTable("login_codes", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id"),
  email: text("email").notNull(),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const slotHolds = pgTable("slot_holds", {
  id: serial("id").primaryKey(),
  slotKey: text("slot_key").notNull(),
  customerEmail: text("customer_email").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
