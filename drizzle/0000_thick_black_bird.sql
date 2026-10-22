-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "iam_tenant_member" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "iam_tenant_member_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tenant_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"employee_code" varchar(50),
	"department_id" bigint,
	"job_title" varchar(150),
	"status" varchar(20) DEFAULT 'ACTIVE' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"left_at" timestamp with time zone,
	CONSTRAINT "iam_tenant_member_tenant_id_user_id_key" UNIQUE("tenant_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "iam_user" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "iam_user_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"external_subject" varchar(255),
	"nik" varchar(50),
	"username" varchar(100) NOT NULL,
	"full_name" varchar(150) NOT NULL,
	"email" varchar(150),
	"phone" varchar(50),
	"avatar_url" text,
	"status" varchar(20) DEFAULT 'ACTIVE' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "iam_user_username_key" UNIQUE("username"),
	CONSTRAINT "chk_user_status" CHECK ((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying, 'LOCKED'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE "saas_tenant" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "saas_tenant_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tenant_code" varchar(50) NOT NULL,
	"tenant_name" varchar(150) NOT NULL,
	"legal_name" varchar(255),
	"timezone" varchar(64) DEFAULT 'Asia/Jakarta' NOT NULL,
	"locale" varchar(20) DEFAULT 'id-ID' NOT NULL,
	"currency" varchar(3) DEFAULT 'IDR' NOT NULL,
	"status" varchar(20) DEFAULT 'ACTIVE' NOT NULL,
	"logo_url" text,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "uq_tenant_code" UNIQUE("tenant_code"),
	CONSTRAINT "chk_tenant_status" CHECK ((status)::text = ANY ((ARRAY['TRIAL'::character varying, 'ACTIVE'::character varying, 'SUSPENDED'::character varying, 'CANCELLED'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE "saas_tenant_setting" (
	"tenant_id" bigint PRIMARY KEY NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saas_subscription" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "saas_subscription_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tenant_id" bigint NOT NULL,
	"plan_id" bigint NOT NULL,
	"status" varchar(20) DEFAULT 'ACTIVE' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"expired_at" timestamp with time zone,
	"external_subscription_id" varchar(150),
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saas_plan" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "saas_plan_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"plan_code" varchar(50) NOT NULL,
	"plan_name" varchar(100) NOT NULL,
	"max_users" integer,
	"max_rooms" integer,
	"max_bookings_per_month" integer,
	"features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"price_monthly" numeric(14, 2),
	"price_yearly" numeric(14, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "saas_plan_plan_code_key" UNIQUE("plan_code")
);
--> statement-breakpoint
CREATE TABLE "org_department" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "org_department_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tenant_id" bigint NOT NULL,
	"department_code" varchar(50) NOT NULL,
	"department_name" varchar(150) NOT NULL,
	"parent_id" bigint,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "org_department_tenant_id_department_code_key" UNIQUE("department_code","tenant_id")
);
--> statement-breakpoint
CREATE TABLE "org_location" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "org_location_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tenant_id" bigint NOT NULL,
	"location_code" varchar(50) NOT NULL,
	"location_name" varchar(150) NOT NULL,
	"address" text,
	"timezone" varchar(64),
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "org_location_tenant_id_location_code_key" UNIQUE("location_code","tenant_id")
);
--> statement-breakpoint
CREATE TABLE "org_project" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "org_project_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tenant_id" bigint NOT NULL,
	"project_code" varchar(50) NOT NULL,
	"project_name" varchar(150) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "org_project_tenant_id_project_code_key" UNIQUE("project_code","tenant_id")
);
--> statement-breakpoint
CREATE TABLE "iam_role" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "iam_role_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tenant_id" bigint,
	"role_code" varchar(50) NOT NULL,
	"role_name" varchar(100) NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "iam_role_tenant_id_role_code_key" UNIQUE("role_code","tenant_id")
);
--> statement-breakpoint
CREATE TABLE "iam_permission" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "iam_permission_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"permission_code" varchar(100) NOT NULL,
	"permission_name" varchar(150) NOT NULL,
	"module" varchar(50) NOT NULL,
	"description" text,
	CONSTRAINT "iam_permission_permission_code_key" UNIQUE("permission_code")
);
--> statement-breakpoint
CREATE TABLE "iam_role_scope" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "iam_role_scope_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"role_id" bigint NOT NULL,
	"permission_id" bigint NOT NULL,
	"scope_type" varchar(30) NOT NULL,
	"scope_value" bigint,
	CONSTRAINT "chk_scope_type" CHECK ((scope_type)::text = ANY ((ARRAY['OWN'::character varying, 'DEPARTMENT'::character varying, 'LOCATION'::character varying, 'PROJECT'::character varying, 'ALL'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE "meeting_room" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "meeting_room_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tenant_id" bigint NOT NULL,
	"location_id" bigint NOT NULL,
	"room_code" varchar(50) NOT NULL,
	"room_name" varchar(150) NOT NULL,
	"floor" varchar(50),
	"capacity" integer DEFAULT 1 NOT NULL,
	"description" text,
	"status" varchar(20) DEFAULT 'AVAILABLE' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_by" bigint,
	"updated_at" timestamp with time zone,
	"updated_by" bigint,
	CONSTRAINT "meeting_room_tenant_id_room_code_key" UNIQUE("room_code","tenant_id"),
	CONSTRAINT "meeting_room_capacity_check" CHECK (capacity > 0),
	CONSTRAINT "meeting_room_status_check" CHECK ((status)::text = ANY ((ARRAY['AVAILABLE'::character varying, 'MAINTENANCE'::character varying, 'INACTIVE'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE "meeting_approval" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "meeting_approval_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tenant_id" bigint NOT NULL,
	"booking_id" bigint NOT NULL,
	"sequence_no" integer NOT NULL,
	"approver_member_id" bigint NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"acted_at" timestamp with time zone,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "meeting_approval_booking_id_sequence_no_key" UNIQUE("booking_id","sequence_no"),
	CONSTRAINT "meeting_approval_status_check" CHECK ((status)::text = ANY ((ARRAY['PENDING'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE "meeting_attachment" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "meeting_attachment_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tenant_id" bigint NOT NULL,
	"booking_id" bigint NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" varchar(100),
	"file_size" bigint,
	"uploaded_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"uploaded_by" bigint,
	CONSTRAINT "meeting_attachment_file_size_check" CHECK ((file_size IS NULL) OR (file_size >= 0))
);
--> statement-breakpoint
CREATE TABLE "meeting_booking_status_history" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "meeting_booking_status_history_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tenant_id" bigint NOT NULL,
	"booking_id" bigint NOT NULL,
	"old_status" varchar(30),
	"new_status" varchar(30) NOT NULL,
	"reason" text,
	"changed_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"changed_by" bigint
);
--> statement-breakpoint
CREATE TABLE "meeting_checkin" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "meeting_checkin_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tenant_id" bigint NOT NULL,
	"booking_id" bigint NOT NULL,
	"member_id" bigint,
	"checkin_type" varchar(20) DEFAULT 'ORGANIZER' NOT NULL,
	"checkin_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"checkout_at" timestamp with time zone,
	"source" varchar(20) DEFAULT 'WEB' NOT NULL,
	"qr_token" uuid,
	"notes" text,
	CONSTRAINT "meeting_checkin_check" CHECK ((checkout_at IS NULL) OR (checkout_at >= checkin_at))
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "notification_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tenant_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"notification_type" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"reference_type" varchar(50),
	"reference_id" bigint,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_facility" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "meeting_facility_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tenant_id" bigint NOT NULL,
	"facility_code" varchar(50) NOT NULL,
	"facility_name" varchar(100) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "meeting_facility_tenant_id_facility_code_key" UNIQUE("facility_code","tenant_id")
);
--> statement-breakpoint
CREATE TABLE "meeting_room_reservation" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "meeting_room_reservation_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tenant_id" bigint NOT NULL,
	"room_id" bigint NOT NULL,
	"booking_id" bigint,
	"block_id" bigint,
	"reservation_type" varchar(20) NOT NULL,
	"during" "tstzrange" NOT NULL,
	"status" varchar(20) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "chk_reservation_type" CHECK ((reservation_type)::text = ANY ((ARRAY['BOOKING'::character varying, 'BLOCK'::character varying])::text[])),
	CONSTRAINT "chk_reservation_status" CHECK ((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'CANCELLED'::character varying])::text[])),
	CONSTRAINT "chk_reservation_source" CHECK ((((reservation_type)::text = 'BOOKING'::text) AND (booking_id IS NOT NULL) AND (block_id IS NULL)) OR (((reservation_type)::text = 'BLOCK'::text) AND (block_id IS NOT NULL) AND (booking_id IS NULL))),
	CONSTRAINT "chk_reservation_period" CHECK (NOT isempty(during))
);
--> statement-breakpoint
CREATE TABLE "meeting_type" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "meeting_type_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tenant_id" bigint NOT NULL,
	"type_code" varchar(50) NOT NULL,
	"type_name" varchar(100) NOT NULL,
	"require_approval" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "meeting_type_tenant_id_type_code_key" UNIQUE("tenant_id","type_code")
);
--> statement-breakpoint
CREATE TABLE "meeting_series" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "meeting_series_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tenant_id" bigint NOT NULL,
	"series_code" varchar(50) NOT NULL,
	"recurrence_rule" text,
	"timezone" varchar(64) DEFAULT 'Asia/Jakarta' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "meeting_series_tenant_id_series_code_key" UNIQUE("series_code","tenant_id")
);
--> statement-breakpoint
CREATE TABLE "meeting_room_block" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "meeting_room_block_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tenant_id" bigint NOT NULL,
	"room_id" bigint NOT NULL,
	"reason" varchar(255) NOT NULL,
	"block_type" varchar(30) DEFAULT 'MAINTENANCE' NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"status" varchar(20) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_by" bigint,
	CONSTRAINT "meeting_room_block_check" CHECK (end_at > start_at),
	CONSTRAINT "meeting_room_block_block_type_check" CHECK ((block_type)::text = ANY ((ARRAY['MAINTENANCE'::character varying, 'EVENT'::character varying, 'PRIVATE'::character varying, 'OTHER'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE "meeting_participant" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "meeting_participant_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tenant_id" bigint NOT NULL,
	"booking_id" bigint NOT NULL,
	"member_id" bigint,
	"participant_name" varchar(150) NOT NULL,
	"email" varchar(150),
	"participant_type" varchar(20) DEFAULT 'INTERNAL' NOT NULL,
	"attendance_status" varchar(20) DEFAULT 'INVITED' NOT NULL,
	"invited_at" timestamp with time zone,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "meeting_participant_participant_type_check" CHECK ((participant_type)::text = ANY ((ARRAY['INTERNAL'::character varying, 'EXTERNAL'::character varying])::text[])),
	CONSTRAINT "meeting_participant_attendance_status_check" CHECK ((attendance_status)::text = ANY ((ARRAY['INVITED'::character varying, 'ACCEPTED'::character varying, 'DECLINED'::character varying, 'ATTENDED'::character varying, 'ABSENT'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE "meeting_booking" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "meeting_booking_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tenant_id" bigint NOT NULL,
	"booking_no" varchar(50) NOT NULL,
	"room_id" bigint NOT NULL,
	"organizer_member_id" bigint NOT NULL,
	"project_id" bigint,
	"meeting_type_id" bigint,
	"series_id" bigint,
	"title" varchar(255) NOT NULL,
	"agenda" text,
	"special_request" text,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"participant_count" integer DEFAULT 1 NOT NULL,
	"status" varchar(30) DEFAULT 'PENDING' NOT NULL,
	"cancellation_reason" text,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_by" bigint NOT NULL,
	"updated_at" timestamp with time zone,
	"updated_by" bigint,
	"deleted_at" timestamp with time zone,
	"deleted_by" bigint,
	CONSTRAINT "meeting_booking_tenant_id_booking_no_key" UNIQUE("booking_no","tenant_id"),
	CONSTRAINT "meeting_booking_check" CHECK (end_at > start_at),
	CONSTRAINT "meeting_booking_participant_count_check" CHECK (participant_count > 0),
	CONSTRAINT "meeting_booking_status_check" CHECK ((status)::text = ANY ((ARRAY['DRAFT'::character varying, 'PENDING'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying, 'CANCELLED'::character varying, 'POSTPONED'::character varying, 'COMPLETED'::character varying, 'NO_SHOW'::character varying])::text[]))
);
--> statement-breakpoint
ALTER TABLE "meeting_booking" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tenant_id" bigint,
	"user_id" bigint,
	"actor_nik" varchar(50),
	"module" varchar(50) NOT NULL,
	"table_name" varchar(100),
	"record_id" bigint,
	"action" varchar(50) NOT NULL,
	"old_data" jsonb,
	"new_data" jsonb,
	"ip_address" "inet",
	"user_agent" text,
	"request_id" uuid,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_login" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_login_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint,
	"tenant_id" bigint,
	"login_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"ip_address" "inet",
	"user_agent" text,
	"device_id" varchar(150),
	"platform" varchar(30),
	"success" boolean NOT NULL,
	"failure_reason" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "iam_role_permission" (
	"role_id" bigint NOT NULL,
	"permission_id" bigint NOT NULL,
	CONSTRAINT "iam_role_permission_pkey" PRIMARY KEY("permission_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "iam_member_role" (
	"member_id" bigint NOT NULL,
	"role_id" bigint NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"assigned_by" bigint,
	CONSTRAINT "iam_member_role_pkey" PRIMARY KEY("member_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "meeting_room_facility" (
	"room_id" bigint NOT NULL,
	"facility_id" bigint NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"notes" text,
	CONSTRAINT "meeting_room_facility_pkey" PRIMARY KEY("facility_id","room_id")
);
--> statement-breakpoint
ALTER TABLE "iam_tenant_member" ADD CONSTRAINT "iam_tenant_member_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."saas_tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam_tenant_member" ADD CONSTRAINT "iam_tenant_member_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."iam_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_tenant_setting" ADD CONSTRAINT "fk_setting_tenant" FOREIGN KEY ("tenant_id") REFERENCES "public"."saas_tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_subscription" ADD CONSTRAINT "saas_subscription_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."saas_tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_subscription" ADD CONSTRAINT "saas_subscription_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."saas_plan"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_department" ADD CONSTRAINT "org_department_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."saas_tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_department" ADD CONSTRAINT "org_department_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."org_department"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_location" ADD CONSTRAINT "org_location_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."saas_tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_project" ADD CONSTRAINT "org_project_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."saas_tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam_role_scope" ADD CONSTRAINT "iam_role_scope_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."iam_role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam_role_scope" ADD CONSTRAINT "iam_role_scope_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."iam_permission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_room" ADD CONSTRAINT "meeting_room_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."saas_tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_room" ADD CONSTRAINT "meeting_room_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."org_location"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_approval" ADD CONSTRAINT "meeting_approval_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."saas_tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_approval" ADD CONSTRAINT "meeting_approval_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."meeting_booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_approval" ADD CONSTRAINT "meeting_approval_approver_member_id_fkey" FOREIGN KEY ("approver_member_id") REFERENCES "public"."iam_tenant_member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_attachment" ADD CONSTRAINT "meeting_attachment_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."saas_tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_attachment" ADD CONSTRAINT "meeting_attachment_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."meeting_booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_booking_status_history" ADD CONSTRAINT "meeting_booking_status_history_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."saas_tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_booking_status_history" ADD CONSTRAINT "meeting_booking_status_history_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."meeting_booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_checkin" ADD CONSTRAINT "meeting_checkin_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."saas_tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_checkin" ADD CONSTRAINT "meeting_checkin_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."meeting_booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_checkin" ADD CONSTRAINT "meeting_checkin_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."iam_tenant_member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."saas_tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."iam_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_facility" ADD CONSTRAINT "meeting_facility_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."saas_tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_room_reservation" ADD CONSTRAINT "meeting_room_reservation_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."saas_tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_room_reservation" ADD CONSTRAINT "meeting_room_reservation_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."meeting_room"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_room_reservation" ADD CONSTRAINT "meeting_room_reservation_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."meeting_booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_room_reservation" ADD CONSTRAINT "fk_reservation_block" FOREIGN KEY ("block_id") REFERENCES "public"."meeting_room_block"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_type" ADD CONSTRAINT "meeting_type_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."saas_tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_series" ADD CONSTRAINT "meeting_series_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."saas_tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_room_block" ADD CONSTRAINT "meeting_room_block_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."saas_tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_room_block" ADD CONSTRAINT "meeting_room_block_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."meeting_room"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_participant" ADD CONSTRAINT "meeting_participant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."saas_tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_participant" ADD CONSTRAINT "meeting_participant_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."meeting_booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_participant" ADD CONSTRAINT "meeting_participant_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."iam_tenant_member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_booking" ADD CONSTRAINT "meeting_booking_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."saas_tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_booking" ADD CONSTRAINT "meeting_booking_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."meeting_room"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_booking" ADD CONSTRAINT "meeting_booking_organizer_member_id_fkey" FOREIGN KEY ("organizer_member_id") REFERENCES "public"."iam_tenant_member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_booking" ADD CONSTRAINT "meeting_booking_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."org_project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_booking" ADD CONSTRAINT "meeting_booking_meeting_type_id_fkey" FOREIGN KEY ("meeting_type_id") REFERENCES "public"."meeting_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_booking" ADD CONSTRAINT "meeting_booking_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "public"."meeting_series"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam_role_permission" ADD CONSTRAINT "iam_role_permission_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."iam_role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam_role_permission" ADD CONSTRAINT "iam_role_permission_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."iam_permission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam_member_role" ADD CONSTRAINT "iam_member_role_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."iam_tenant_member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam_member_role" ADD CONSTRAINT "iam_member_role_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."iam_role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_room_facility" ADD CONSTRAINT "meeting_room_facility_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."meeting_room"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_room_facility" ADD CONSTRAINT "meeting_room_facility_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "public"."meeting_facility"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_notification_user" ON "notification" USING btree ("tenant_id" bool_ops,"user_id" int8_ops,"is_read" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_participant_booking" ON "meeting_participant" USING btree ("tenant_id" int8_ops,"booking_id" int8_ops);--> statement-breakpoint
CREATE INDEX "idx_booking_organizer" ON "meeting_booking" USING btree ("tenant_id" int8_ops,"organizer_member_id" int8_ops);--> statement-breakpoint
CREATE INDEX "idx_booking_room" ON "meeting_booking" USING btree ("tenant_id" int8_ops,"room_id" int8_ops,"start_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_booking_tenant_start" ON "meeting_booking" USING btree ("tenant_id" timestamptz_ops,"start_at" int8_ops);--> statement-breakpoint
CREATE INDEX "idx_booking_tenant_status" ON "meeting_booking" USING btree ("tenant_id" text_ops,"status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_audit_tenant_date" ON "audit_log" USING btree ("tenant_id" int8_ops,"created_at" int8_ops);--> statement-breakpoint
CREATE POLICY "tenant_isolation_booking" ON "meeting_booking" AS PERMISSIVE FOR ALL TO public USING ((tenant_id = (current_setting('app.tenant_id'::text))::bigint));
*/