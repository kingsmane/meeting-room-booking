import { pgTable, foreignKey, unique, bigint, varchar, timestamp, check, text, jsonb, integer, numeric, boolean, uuid, index, date, pgPolicy, inet, primaryKey, customType } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

// Postgres range type, dipakai exclusion constraint anti-bentrok ruangan (format: [start,end))
const tstzrange = customType<{ data: string }>({
	dataType() {
		return "tstzrange";
	},
});



export const iamTenantMember = pgTable("iam_tenant_member", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "iam_tenant_member_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	tenantId: bigint("tenant_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	userId: bigint("user_id", { mode: "number" }).notNull(),
	employeeCode: varchar("employee_code", { length: 50 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	departmentId: bigint("department_id", { mode: "number" }),
	jobTitle: varchar("job_title", { length: 150 }),
	status: varchar({ length: 20 }).default('ACTIVE').notNull(),
	joinedAt: timestamp("joined_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	leftAt: timestamp("left_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [saasTenant.id],
			name: "iam_tenant_member_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [iamUser.id],
			name: "iam_tenant_member_user_id_fkey"
		}).onDelete("cascade"),
	unique("iam_tenant_member_tenant_id_user_id_key").on(table.tenantId, table.userId),
]);

export const iamUser = pgTable("iam_user", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "iam_user_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	externalSubject: varchar("external_subject", { length: 255 }),
	nik: varchar({ length: 50 }),
	username: varchar({ length: 100 }).notNull(),
	fullName: varchar("full_name", { length: 150 }).notNull(),
	email: varchar({ length: 150 }),
	phone: varchar({ length: 50 }),
	avatarUrl: text("avatar_url"),
	passwordHash: text("password_hash"),
	status: varchar({ length: 20 }).default('ACTIVE').notNull(),
	lastLoginAt: timestamp("last_login_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	unique("iam_user_username_key").on(table.username),
	check("chk_user_status", sql`(status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying, 'LOCKED'::character varying])::text[])`),
]);

export const saasTenant = pgTable("saas_tenant", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "saas_tenant_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	tenantCode: varchar("tenant_code", { length: 50 }).notNull(),
	tenantName: varchar("tenant_name", { length: 150 }).notNull(),
	legalName: varchar("legal_name", { length: 255 }),
	timezone: varchar({ length: 64 }).default('Asia/Jakarta').notNull(),
	locale: varchar({ length: 20 }).default('id-ID').notNull(),
	currency: varchar({ length: 3 }).default('IDR').notNull(),
	status: varchar({ length: 20 }).default('ACTIVE').notNull(),
	logoUrl: text("logo_url"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	unique("uq_tenant_code").on(table.tenantCode),
	check("chk_tenant_status", sql`(status)::text = ANY ((ARRAY['TRIAL'::character varying, 'ACTIVE'::character varying, 'SUSPENDED'::character varying, 'CANCELLED'::character varying])::text[])`),
]);

export const saasTenantSetting = pgTable("saas_tenant_setting", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	tenantId: bigint("tenant_id", { mode: "number" }).primaryKey().notNull(),
	settings: jsonb().default({}).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [saasTenant.id],
			name: "fk_setting_tenant"
		}).onDelete("cascade"),
]);

export const saasSubscription = pgTable("saas_subscription", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "saas_subscription_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	tenantId: bigint("tenant_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	planId: bigint("plan_id", { mode: "number" }).notNull(),
	status: varchar({ length: 20 }).default('ACTIVE').notNull(),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).notNull(),
	expiredAt: timestamp("expired_at", { withTimezone: true, mode: 'string' }),
	externalSubscriptionId: varchar("external_subscription_id", { length: 150 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [saasTenant.id],
			name: "saas_subscription_tenant_id_fkey"
		}),
	foreignKey({
			columns: [table.planId],
			foreignColumns: [saasPlan.id],
			name: "saas_subscription_plan_id_fkey"
		}),
]);

export const saasPlan = pgTable("saas_plan", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "saas_plan_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	planCode: varchar("plan_code", { length: 50 }).notNull(),
	planName: varchar("plan_name", { length: 100 }).notNull(),
	maxUsers: integer("max_users"),
	maxRooms: integer("max_rooms"),
	maxBookingsPerMonth: integer("max_bookings_per_month"),
	features: jsonb().default({}).notNull(),
	priceMonthly: numeric("price_monthly", { precision: 14, scale:  2 }),
	priceYearly: numeric("price_yearly", { precision: 14, scale:  2 }),
	isActive: boolean("is_active").default(true).notNull(),
}, (table) => [
	unique("saas_plan_plan_code_key").on(table.planCode),
]);

export const orgDepartment = pgTable("org_department", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "org_department_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	tenantId: bigint("tenant_id", { mode: "number" }).notNull(),
	departmentCode: varchar("department_code", { length: 50 }).notNull(),
	departmentName: varchar("department_name", { length: 150 }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	parentId: bigint("parent_id", { mode: "number" }),
	isActive: boolean("is_active").default(true).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [saasTenant.id],
			name: "org_department_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.parentId],
			foreignColumns: [table.id],
			name: "org_department_parent_id_fkey"
		}),
	unique("org_department_tenant_id_department_code_key").on(table.departmentCode, table.tenantId),
]);

export const orgLocation = pgTable("org_location", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "org_location_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	tenantId: bigint("tenant_id", { mode: "number" }).notNull(),
	locationCode: varchar("location_code", { length: 50 }).notNull(),
	locationName: varchar("location_name", { length: 150 }).notNull(),
	address: text(),
	timezone: varchar({ length: 64 }),
	isActive: boolean("is_active").default(true).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [saasTenant.id],
			name: "org_location_tenant_id_fkey"
		}).onDelete("cascade"),
	unique("org_location_tenant_id_location_code_key").on(table.locationCode, table.tenantId),
]);

export const orgProject = pgTable("org_project", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "org_project_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	tenantId: bigint("tenant_id", { mode: "number" }).notNull(),
	projectCode: varchar("project_code", { length: 50 }).notNull(),
	projectName: varchar("project_name", { length: 150 }).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [saasTenant.id],
			name: "org_project_tenant_id_fkey"
		}).onDelete("cascade"),
	unique("org_project_tenant_id_project_code_key").on(table.projectCode, table.tenantId),
]);

export const iamRole = pgTable("iam_role", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "iam_role_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	tenantId: bigint("tenant_id", { mode: "number" }),
	roleCode: varchar("role_code", { length: 50 }).notNull(),
	roleName: varchar("role_name", { length: 100 }).notNull(),
	description: text(),
	isSystem: boolean("is_system").default(false).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
}, (table) => [
	unique("iam_role_tenant_id_role_code_key").on(table.roleCode, table.tenantId),
]);

export const iamPermission = pgTable("iam_permission", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "iam_permission_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	permissionCode: varchar("permission_code", { length: 100 }).notNull(),
	permissionName: varchar("permission_name", { length: 150 }).notNull(),
	module: varchar({ length: 50 }).notNull(),
	description: text(),
}, (table) => [
	unique("iam_permission_permission_code_key").on(table.permissionCode),
]);

export const iamRoleScope = pgTable("iam_role_scope", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "iam_role_scope_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	roleId: bigint("role_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	permissionId: bigint("permission_id", { mode: "number" }).notNull(),
	scopeType: varchar("scope_type", { length: 30 }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	scopeValue: bigint("scope_value", { mode: "number" }),
}, (table) => [
	foreignKey({
			columns: [table.roleId],
			foreignColumns: [iamRole.id],
			name: "iam_role_scope_role_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.permissionId],
			foreignColumns: [iamPermission.id],
			name: "iam_role_scope_permission_id_fkey"
		}).onDelete("cascade"),
	check("chk_scope_type", sql`(scope_type)::text = ANY ((ARRAY['OWN'::character varying, 'DEPARTMENT'::character varying, 'LOCATION'::character varying, 'PROJECT'::character varying, 'ALL'::character varying])::text[])`),
]);

export const meetingRoom = pgTable("meeting_room", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "meeting_room_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	tenantId: bigint("tenant_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	locationId: bigint("location_id", { mode: "number" }).notNull(),
	roomCode: varchar("room_code", { length: 50 }).notNull(),
	roomName: varchar("room_name", { length: 150 }).notNull(),
	floor: varchar({ length: 50 }),
	capacity: integer().default(1).notNull(),
	description: text(),
	status: varchar({ length: 20 }).default('AVAILABLE').notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	createdBy: bigint("created_by", { mode: "number" }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	updatedBy: bigint("updated_by", { mode: "number" }),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [saasTenant.id],
			name: "meeting_room_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.locationId],
			foreignColumns: [orgLocation.id],
			name: "meeting_room_location_id_fkey"
		}),
	unique("meeting_room_tenant_id_room_code_key").on(table.roomCode, table.tenantId),
	check("meeting_room_capacity_check", sql`capacity > 0`),
	check("meeting_room_status_check", sql`(status)::text = ANY ((ARRAY['AVAILABLE'::character varying, 'MAINTENANCE'::character varying, 'INACTIVE'::character varying])::text[])`),
]);

export const meetingApproval = pgTable("meeting_approval", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "meeting_approval_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	tenantId: bigint("tenant_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	bookingId: bigint("booking_id", { mode: "number" }).notNull(),
	sequenceNo: integer("sequence_no").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	approverMemberId: bigint("approver_member_id", { mode: "number" }).notNull(),
	status: varchar({ length: 20 }).default('PENDING').notNull(),
	actedAt: timestamp("acted_at", { withTimezone: true, mode: 'string' }),
	remarks: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [saasTenant.id],
			name: "meeting_approval_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.bookingId],
			foreignColumns: [meetingBooking.id],
			name: "meeting_approval_booking_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.approverMemberId],
			foreignColumns: [iamTenantMember.id],
			name: "meeting_approval_approver_member_id_fkey"
		}),
	unique("meeting_approval_booking_id_sequence_no_key").on(table.bookingId, table.sequenceNo),
	check("meeting_approval_status_check", sql`(status)::text = ANY ((ARRAY['PENDING'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying])::text[])`),
]);

export const meetingAttachment = pgTable("meeting_attachment", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "meeting_attachment_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	tenantId: bigint("tenant_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	bookingId: bigint("booking_id", { mode: "number" }).notNull(),
	fileName: varchar("file_name", { length: 255 }).notNull(),
	storageKey: text("storage_key").notNull(),
	mimeType: varchar("mime_type", { length: 100 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	fileSize: bigint("file_size", { mode: "number" }),
	uploadedAt: timestamp("uploaded_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	uploadedBy: bigint("uploaded_by", { mode: "number" }),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [saasTenant.id],
			name: "meeting_attachment_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.bookingId],
			foreignColumns: [meetingBooking.id],
			name: "meeting_attachment_booking_id_fkey"
		}).onDelete("cascade"),
	check("meeting_attachment_file_size_check", sql`(file_size IS NULL) OR (file_size >= 0)`),
]);

export const meetingBookingStatusHistory = pgTable("meeting_booking_status_history", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "meeting_booking_status_history_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	tenantId: bigint("tenant_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	bookingId: bigint("booking_id", { mode: "number" }).notNull(),
	oldStatus: varchar("old_status", { length: 30 }),
	newStatus: varchar("new_status", { length: 30 }).notNull(),
	reason: text(),
	changedAt: timestamp("changed_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	changedBy: bigint("changed_by", { mode: "number" }),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [saasTenant.id],
			name: "meeting_booking_status_history_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.bookingId],
			foreignColumns: [meetingBooking.id],
			name: "meeting_booking_status_history_booking_id_fkey"
		}).onDelete("cascade"),
]);

export const meetingCheckin = pgTable("meeting_checkin", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "meeting_checkin_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	tenantId: bigint("tenant_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	bookingId: bigint("booking_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	memberId: bigint("member_id", { mode: "number" }),
	checkinType: varchar("checkin_type", { length: 20 }).default('ORGANIZER').notNull(),
	checkinAt: timestamp("checkin_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	checkoutAt: timestamp("checkout_at", { withTimezone: true, mode: 'string' }),
	source: varchar({ length: 20 }).default('WEB').notNull(),
	qrToken: uuid("qr_token"),
	notes: text(),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [saasTenant.id],
			name: "meeting_checkin_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.bookingId],
			foreignColumns: [meetingBooking.id],
			name: "meeting_checkin_booking_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.memberId],
			foreignColumns: [iamTenantMember.id],
			name: "meeting_checkin_member_id_fkey"
		}),
	check("meeting_checkin_check", sql`(checkout_at IS NULL) OR (checkout_at >= checkin_at)`),
]);

export const notification = pgTable("notification", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "notification_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	tenantId: bigint("tenant_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	userId: bigint("user_id", { mode: "number" }).notNull(),
	notificationType: varchar("notification_type", { length: 50 }).notNull(),
	title: varchar({ length: 255 }).notNull(),
	message: text().notNull(),
	referenceType: varchar("reference_type", { length: 50 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	referenceId: bigint("reference_id", { mode: "number" }),
	isRead: boolean("is_read").default(false).notNull(),
	readAt: timestamp("read_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("idx_notification_user").using("btree", table.tenantId.asc().nullsLast().op("bool_ops"), table.userId.asc().nullsLast().op("int8_ops"), table.isRead.asc().nullsLast().op("bool_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [saasTenant.id],
			name: "notification_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [iamUser.id],
			name: "notification_user_id_fkey"
		}).onDelete("cascade"),
]);

export const meetingFacility = pgTable("meeting_facility", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "meeting_facility_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	tenantId: bigint("tenant_id", { mode: "number" }).notNull(),
	facilityCode: varchar("facility_code", { length: 50 }).notNull(),
	facilityName: varchar("facility_name", { length: 100 }).notNull(),
	description: text(),
	isActive: boolean("is_active").default(true).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [saasTenant.id],
			name: "meeting_facility_tenant_id_fkey"
		}).onDelete("cascade"),
	unique("meeting_facility_tenant_id_facility_code_key").on(table.facilityCode, table.tenantId),
]);

export const meetingRoomReservation = pgTable("meeting_room_reservation", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "meeting_room_reservation_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	tenantId: bigint("tenant_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	roomId: bigint("room_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	bookingId: bigint("booking_id", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	blockId: bigint("block_id", { mode: "number" }),
	reservationType: varchar("reservation_type", { length: 20 }).notNull(),
	during: tstzrange("during").notNull(),
	status: varchar({ length: 20 }).default('ACTIVE').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [saasTenant.id],
			name: "meeting_room_reservation_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.roomId],
			foreignColumns: [meetingRoom.id],
			name: "meeting_room_reservation_room_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.bookingId],
			foreignColumns: [meetingBooking.id],
			name: "meeting_room_reservation_booking_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.blockId],
			foreignColumns: [meetingRoomBlock.id],
			name: "fk_reservation_block"
		}).onDelete("cascade"),
	check("chk_reservation_type", sql`(reservation_type)::text = ANY ((ARRAY['BOOKING'::character varying, 'BLOCK'::character varying])::text[])`),
	check("chk_reservation_status", sql`(status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'CANCELLED'::character varying])::text[])`),
	check("chk_reservation_source", sql`(((reservation_type)::text = 'BOOKING'::text) AND (booking_id IS NOT NULL) AND (block_id IS NULL)) OR (((reservation_type)::text = 'BLOCK'::text) AND (block_id IS NOT NULL) AND (booking_id IS NULL))`),
	check("chk_reservation_period", sql`NOT isempty(during)`),
]);

export const meetingType = pgTable("meeting_type", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "meeting_type_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	tenantId: bigint("tenant_id", { mode: "number" }).notNull(),
	typeCode: varchar("type_code", { length: 50 }).notNull(),
	typeName: varchar("type_name", { length: 100 }).notNull(),
	requireApproval: boolean("require_approval").default(false).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [saasTenant.id],
			name: "meeting_type_tenant_id_fkey"
		}).onDelete("cascade"),
	unique("meeting_type_tenant_id_type_code_key").on(table.tenantId, table.typeCode),
]);

export const meetingSeries = pgTable("meeting_series", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "meeting_series_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	tenantId: bigint("tenant_id", { mode: "number" }).notNull(),
	seriesCode: varchar("series_code", { length: 50 }).notNull(),
	recurrenceRule: text("recurrence_rule"),
	timezone: varchar({ length: 64 }).default('Asia/Jakarta').notNull(),
	startDate: date("start_date").notNull(),
	endDate: date("end_date"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [saasTenant.id],
			name: "meeting_series_tenant_id_fkey"
		}).onDelete("cascade"),
	unique("meeting_series_tenant_id_series_code_key").on(table.seriesCode, table.tenantId),
]);

export const meetingRoomBlock = pgTable("meeting_room_block", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "meeting_room_block_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	tenantId: bigint("tenant_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	roomId: bigint("room_id", { mode: "number" }).notNull(),
	reason: varchar({ length: 255 }).notNull(),
	blockType: varchar("block_type", { length: 30 }).default('MAINTENANCE').notNull(),
	startAt: timestamp("start_at", { withTimezone: true, mode: 'string' }).notNull(),
	endAt: timestamp("end_at", { withTimezone: true, mode: 'string' }).notNull(),
	status: varchar({ length: 20 }).default('ACTIVE').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	createdBy: bigint("created_by", { mode: "number" }),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [saasTenant.id],
			name: "meeting_room_block_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.roomId],
			foreignColumns: [meetingRoom.id],
			name: "meeting_room_block_room_id_fkey"
		}),
	check("meeting_room_block_check", sql`end_at > start_at`),
	check("meeting_room_block_block_type_check", sql`(block_type)::text = ANY ((ARRAY['MAINTENANCE'::character varying, 'EVENT'::character varying, 'PRIVATE'::character varying, 'OTHER'::character varying])::text[])`),
]);

export const meetingParticipant = pgTable("meeting_participant", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "meeting_participant_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	tenantId: bigint("tenant_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	bookingId: bigint("booking_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	memberId: bigint("member_id", { mode: "number" }),
	participantName: varchar("participant_name", { length: 150 }).notNull(),
	email: varchar({ length: 150 }),
	participantType: varchar("participant_type", { length: 20 }).default('INTERNAL').notNull(),
	attendanceStatus: varchar("attendance_status", { length: 20 }).default('INVITED').notNull(),
	invitedAt: timestamp("invited_at", { withTimezone: true, mode: 'string' }),
	respondedAt: timestamp("responded_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("idx_participant_booking").using("btree", table.tenantId.asc().nullsLast().op("int8_ops"), table.bookingId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [saasTenant.id],
			name: "meeting_participant_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.bookingId],
			foreignColumns: [meetingBooking.id],
			name: "meeting_participant_booking_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.memberId],
			foreignColumns: [iamTenantMember.id],
			name: "meeting_participant_member_id_fkey"
		}),
	check("meeting_participant_participant_type_check", sql`(participant_type)::text = ANY ((ARRAY['INTERNAL'::character varying, 'EXTERNAL'::character varying])::text[])`),
	check("meeting_participant_attendance_status_check", sql`(attendance_status)::text = ANY ((ARRAY['INVITED'::character varying, 'ACCEPTED'::character varying, 'DECLINED'::character varying, 'ATTENDED'::character varying, 'ABSENT'::character varying])::text[])`),
]);

export const meetingBooking = pgTable("meeting_booking", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "meeting_booking_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	tenantId: bigint("tenant_id", { mode: "number" }).notNull(),
	bookingNo: varchar("booking_no", { length: 50 }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	roomId: bigint("room_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	organizerMemberId: bigint("organizer_member_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	projectId: bigint("project_id", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	meetingTypeId: bigint("meeting_type_id", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	seriesId: bigint("series_id", { mode: "number" }),
	title: varchar({ length: 255 }).notNull(),
	agenda: text(),
	specialRequest: text("special_request"),
	startAt: timestamp("start_at", { withTimezone: true, mode: 'string' }).notNull(),
	endAt: timestamp("end_at", { withTimezone: true, mode: 'string' }).notNull(),
	participantCount: integer("participant_count").default(1).notNull(),
	status: varchar({ length: 30 }).default('PENDING').notNull(),
	cancellationReason: text("cancellation_reason"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	createdBy: bigint("created_by", { mode: "number" }).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	updatedBy: bigint("updated_by", { mode: "number" }),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	deletedBy: bigint("deleted_by", { mode: "number" }),
}, (table) => [
	index("idx_booking_organizer").using("btree", table.tenantId.asc().nullsLast().op("int8_ops"), table.organizerMemberId.asc().nullsLast().op("int8_ops")),
	index("idx_booking_room").using("btree", table.tenantId.asc().nullsLast().op("int8_ops"), table.roomId.asc().nullsLast().op("int8_ops"), table.startAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_booking_tenant_start").using("btree", table.tenantId.asc().nullsLast().op("timestamptz_ops"), table.startAt.asc().nullsLast().op("int8_ops")),
	index("idx_booking_tenant_status").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [saasTenant.id],
			name: "meeting_booking_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.roomId],
			foreignColumns: [meetingRoom.id],
			name: "meeting_booking_room_id_fkey"
		}),
	foreignKey({
			columns: [table.organizerMemberId],
			foreignColumns: [iamTenantMember.id],
			name: "meeting_booking_organizer_member_id_fkey"
		}),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [orgProject.id],
			name: "meeting_booking_project_id_fkey"
		}),
	foreignKey({
			columns: [table.meetingTypeId],
			foreignColumns: [meetingType.id],
			name: "meeting_booking_meeting_type_id_fkey"
		}),
	foreignKey({
			columns: [table.seriesId],
			foreignColumns: [meetingSeries.id],
			name: "meeting_booking_series_id_fkey"
		}),
	unique("meeting_booking_tenant_id_booking_no_key").on(table.bookingNo, table.tenantId),
	pgPolicy("tenant_isolation_booking", { as: "permissive", for: "all", to: ["public"], using: sql`(tenant_id = (current_setting('app.tenant_id'::text))::bigint)` }),
	check("meeting_booking_check", sql`end_at > start_at`),
	check("meeting_booking_participant_count_check", sql`participant_count > 0`),
	check("meeting_booking_status_check", sql`(status)::text = ANY ((ARRAY['DRAFT'::character varying, 'PENDING'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying, 'CANCELLED'::character varying, 'POSTPONED'::character varying, 'COMPLETED'::character varying, 'NO_SHOW'::character varying])::text[])`),
]);

export const auditLog = pgTable("audit_log", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "audit_log_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	tenantId: bigint("tenant_id", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	userId: bigint("user_id", { mode: "number" }),
	actorNik: varchar("actor_nik", { length: 50 }),
	module: varchar({ length: 50 }).notNull(),
	tableName: varchar("table_name", { length: 100 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	recordId: bigint("record_id", { mode: "number" }),
	action: varchar({ length: 50 }).notNull(),
	oldData: jsonb("old_data"),
	newData: jsonb("new_data"),
	ipAddress: inet("ip_address"),
	userAgent: text("user_agent"),
	requestId: uuid("request_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("idx_audit_tenant_date").using("btree", table.tenantId.asc().nullsLast().op("int8_ops"), table.createdAt.desc().nullsFirst().op("int8_ops")),
]);

export const auditLogin = pgTable("audit_login", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "audit_login_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	userId: bigint("user_id", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	tenantId: bigint("tenant_id", { mode: "number" }),
	loginAt: timestamp("login_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	ipAddress: inet("ip_address"),
	userAgent: text("user_agent"),
	deviceId: varchar("device_id", { length: 150 }),
	platform: varchar({ length: 30 }),
	success: boolean().notNull(),
	failureReason: varchar("failure_reason", { length: 255 }),
});

export const iamRolePermission = pgTable("iam_role_permission", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	roleId: bigint("role_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	permissionId: bigint("permission_id", { mode: "number" }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.roleId],
			foreignColumns: [iamRole.id],
			name: "iam_role_permission_role_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.permissionId],
			foreignColumns: [iamPermission.id],
			name: "iam_role_permission_permission_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.permissionId, table.roleId], name: "iam_role_permission_pkey"}),
]);

export const iamMemberRole = pgTable("iam_member_role", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	memberId: bigint("member_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	roleId: bigint("role_id", { mode: "number" }).notNull(),
	assignedAt: timestamp("assigned_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	assignedBy: bigint("assigned_by", { mode: "number" }),
}, (table) => [
	foreignKey({
			columns: [table.memberId],
			foreignColumns: [iamTenantMember.id],
			name: "iam_member_role_member_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.roleId],
			foreignColumns: [iamRole.id],
			name: "iam_member_role_role_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.memberId, table.roleId], name: "iam_member_role_pkey"}),
]);

export const meetingRoomFacility = pgTable("meeting_room_facility", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	roomId: bigint("room_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	facilityId: bigint("facility_id", { mode: "number" }).notNull(),
	quantity: integer().default(1).notNull(),
	notes: text(),
}, (table) => [
	foreignKey({
			columns: [table.roomId],
			foreignColumns: [meetingRoom.id],
			name: "meeting_room_facility_room_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.facilityId],
			foreignColumns: [meetingFacility.id],
			name: "meeting_room_facility_facility_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.facilityId, table.roomId], name: "meeting_room_facility_pkey"}),
]);
