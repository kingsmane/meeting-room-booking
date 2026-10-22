import { relations } from "drizzle-orm/relations";
import { saasTenant, iamTenantMember, iamUser, saasTenantSetting, saasSubscription, saasPlan, orgDepartment, orgLocation, orgProject, iamRole, iamRoleScope, iamPermission, meetingRoom, meetingApproval, meetingBooking, meetingAttachment, meetingBookingStatusHistory, meetingCheckin, notification, meetingFacility, meetingRoomReservation, meetingRoomBlock, meetingType, meetingSeries, meetingParticipant, iamRolePermission, iamMemberRole, meetingRoomFacility } from "./schema";

export const iamTenantMemberRelations = relations(iamTenantMember, ({one, many}) => ({
	saasTenant: one(saasTenant, {
		fields: [iamTenantMember.tenantId],
		references: [saasTenant.id]
	}),
	iamUser: one(iamUser, {
		fields: [iamTenantMember.userId],
		references: [iamUser.id]
	}),
	meetingApprovals: many(meetingApproval),
	meetingCheckins: many(meetingCheckin),
	meetingParticipants: many(meetingParticipant),
	meetingBookings: many(meetingBooking),
	iamMemberRoles: many(iamMemberRole),
}));

export const saasTenantRelations = relations(saasTenant, ({many}) => ({
	iamTenantMembers: many(iamTenantMember),
	saasTenantSettings: many(saasTenantSetting),
	saasSubscriptions: many(saasSubscription),
	orgDepartments: many(orgDepartment),
	orgLocations: many(orgLocation),
	orgProjects: many(orgProject),
	meetingRooms: many(meetingRoom),
	meetingApprovals: many(meetingApproval),
	meetingAttachments: many(meetingAttachment),
	meetingBookingStatusHistories: many(meetingBookingStatusHistory),
	meetingCheckins: many(meetingCheckin),
	notifications: many(notification),
	meetingFacilities: many(meetingFacility),
	meetingRoomReservations: many(meetingRoomReservation),
	meetingTypes: many(meetingType),
	meetingSeries: many(meetingSeries),
	meetingRoomBlocks: many(meetingRoomBlock),
	meetingParticipants: many(meetingParticipant),
	meetingBookings: many(meetingBooking),
}));

export const iamUserRelations = relations(iamUser, ({many}) => ({
	iamTenantMembers: many(iamTenantMember),
	notifications: many(notification),
}));

export const saasTenantSettingRelations = relations(saasTenantSetting, ({one}) => ({
	saasTenant: one(saasTenant, {
		fields: [saasTenantSetting.tenantId],
		references: [saasTenant.id]
	}),
}));

export const saasSubscriptionRelations = relations(saasSubscription, ({one}) => ({
	saasTenant: one(saasTenant, {
		fields: [saasSubscription.tenantId],
		references: [saasTenant.id]
	}),
	saasPlan: one(saasPlan, {
		fields: [saasSubscription.planId],
		references: [saasPlan.id]
	}),
}));

export const saasPlanRelations = relations(saasPlan, ({many}) => ({
	saasSubscriptions: many(saasSubscription),
}));

export const orgDepartmentRelations = relations(orgDepartment, ({one, many}) => ({
	saasTenant: one(saasTenant, {
		fields: [orgDepartment.tenantId],
		references: [saasTenant.id]
	}),
	orgDepartment: one(orgDepartment, {
		fields: [orgDepartment.parentId],
		references: [orgDepartment.id],
		relationName: "orgDepartment_parentId_orgDepartment_id"
	}),
	orgDepartments: many(orgDepartment, {
		relationName: "orgDepartment_parentId_orgDepartment_id"
	}),
}));

export const orgLocationRelations = relations(orgLocation, ({one, many}) => ({
	saasTenant: one(saasTenant, {
		fields: [orgLocation.tenantId],
		references: [saasTenant.id]
	}),
	meetingRooms: many(meetingRoom),
}));

export const orgProjectRelations = relations(orgProject, ({one, many}) => ({
	saasTenant: one(saasTenant, {
		fields: [orgProject.tenantId],
		references: [saasTenant.id]
	}),
	meetingBookings: many(meetingBooking),
}));

export const iamRoleScopeRelations = relations(iamRoleScope, ({one}) => ({
	iamRole: one(iamRole, {
		fields: [iamRoleScope.roleId],
		references: [iamRole.id]
	}),
	iamPermission: one(iamPermission, {
		fields: [iamRoleScope.permissionId],
		references: [iamPermission.id]
	}),
}));

export const iamRoleRelations = relations(iamRole, ({many}) => ({
	iamRoleScopes: many(iamRoleScope),
	iamRolePermissions: many(iamRolePermission),
	iamMemberRoles: many(iamMemberRole),
}));

export const iamPermissionRelations = relations(iamPermission, ({many}) => ({
	iamRoleScopes: many(iamRoleScope),
	iamRolePermissions: many(iamRolePermission),
}));

export const meetingRoomRelations = relations(meetingRoom, ({one, many}) => ({
	saasTenant: one(saasTenant, {
		fields: [meetingRoom.tenantId],
		references: [saasTenant.id]
	}),
	orgLocation: one(orgLocation, {
		fields: [meetingRoom.locationId],
		references: [orgLocation.id]
	}),
	meetingRoomReservations: many(meetingRoomReservation),
	meetingRoomBlocks: many(meetingRoomBlock),
	meetingBookings: many(meetingBooking),
	meetingRoomFacilities: many(meetingRoomFacility),
}));

export const meetingApprovalRelations = relations(meetingApproval, ({one}) => ({
	saasTenant: one(saasTenant, {
		fields: [meetingApproval.tenantId],
		references: [saasTenant.id]
	}),
	meetingBooking: one(meetingBooking, {
		fields: [meetingApproval.bookingId],
		references: [meetingBooking.id]
	}),
	iamTenantMember: one(iamTenantMember, {
		fields: [meetingApproval.approverMemberId],
		references: [iamTenantMember.id]
	}),
}));

export const meetingBookingRelations = relations(meetingBooking, ({one, many}) => ({
	meetingApprovals: many(meetingApproval),
	meetingAttachments: many(meetingAttachment),
	meetingBookingStatusHistories: many(meetingBookingStatusHistory),
	meetingCheckins: many(meetingCheckin),
	meetingRoomReservations: many(meetingRoomReservation),
	meetingParticipants: many(meetingParticipant),
	saasTenant: one(saasTenant, {
		fields: [meetingBooking.tenantId],
		references: [saasTenant.id]
	}),
	meetingRoom: one(meetingRoom, {
		fields: [meetingBooking.roomId],
		references: [meetingRoom.id]
	}),
	iamTenantMember: one(iamTenantMember, {
		fields: [meetingBooking.organizerMemberId],
		references: [iamTenantMember.id]
	}),
	orgProject: one(orgProject, {
		fields: [meetingBooking.projectId],
		references: [orgProject.id]
	}),
	meetingType: one(meetingType, {
		fields: [meetingBooking.meetingTypeId],
		references: [meetingType.id]
	}),
	meetingSery: one(meetingSeries, {
		fields: [meetingBooking.seriesId],
		references: [meetingSeries.id]
	}),
}));

export const meetingAttachmentRelations = relations(meetingAttachment, ({one}) => ({
	saasTenant: one(saasTenant, {
		fields: [meetingAttachment.tenantId],
		references: [saasTenant.id]
	}),
	meetingBooking: one(meetingBooking, {
		fields: [meetingAttachment.bookingId],
		references: [meetingBooking.id]
	}),
}));

export const meetingBookingStatusHistoryRelations = relations(meetingBookingStatusHistory, ({one}) => ({
	saasTenant: one(saasTenant, {
		fields: [meetingBookingStatusHistory.tenantId],
		references: [saasTenant.id]
	}),
	meetingBooking: one(meetingBooking, {
		fields: [meetingBookingStatusHistory.bookingId],
		references: [meetingBooking.id]
	}),
}));

export const meetingCheckinRelations = relations(meetingCheckin, ({one}) => ({
	saasTenant: one(saasTenant, {
		fields: [meetingCheckin.tenantId],
		references: [saasTenant.id]
	}),
	meetingBooking: one(meetingBooking, {
		fields: [meetingCheckin.bookingId],
		references: [meetingBooking.id]
	}),
	iamTenantMember: one(iamTenantMember, {
		fields: [meetingCheckin.memberId],
		references: [iamTenantMember.id]
	}),
}));

export const notificationRelations = relations(notification, ({one}) => ({
	saasTenant: one(saasTenant, {
		fields: [notification.tenantId],
		references: [saasTenant.id]
	}),
	iamUser: one(iamUser, {
		fields: [notification.userId],
		references: [iamUser.id]
	}),
}));

export const meetingFacilityRelations = relations(meetingFacility, ({one, many}) => ({
	saasTenant: one(saasTenant, {
		fields: [meetingFacility.tenantId],
		references: [saasTenant.id]
	}),
	meetingRoomFacilities: many(meetingRoomFacility),
}));

export const meetingRoomReservationRelations = relations(meetingRoomReservation, ({one}) => ({
	saasTenant: one(saasTenant, {
		fields: [meetingRoomReservation.tenantId],
		references: [saasTenant.id]
	}),
	meetingRoom: one(meetingRoom, {
		fields: [meetingRoomReservation.roomId],
		references: [meetingRoom.id]
	}),
	meetingBooking: one(meetingBooking, {
		fields: [meetingRoomReservation.bookingId],
		references: [meetingBooking.id]
	}),
	meetingRoomBlock: one(meetingRoomBlock, {
		fields: [meetingRoomReservation.blockId],
		references: [meetingRoomBlock.id]
	}),
}));

export const meetingRoomBlockRelations = relations(meetingRoomBlock, ({one, many}) => ({
	meetingRoomReservations: many(meetingRoomReservation),
	saasTenant: one(saasTenant, {
		fields: [meetingRoomBlock.tenantId],
		references: [saasTenant.id]
	}),
	meetingRoom: one(meetingRoom, {
		fields: [meetingRoomBlock.roomId],
		references: [meetingRoom.id]
	}),
}));

export const meetingTypeRelations = relations(meetingType, ({one, many}) => ({
	saasTenant: one(saasTenant, {
		fields: [meetingType.tenantId],
		references: [saasTenant.id]
	}),
	meetingBookings: many(meetingBooking),
}));

export const meetingSeriesRelations = relations(meetingSeries, ({one, many}) => ({
	saasTenant: one(saasTenant, {
		fields: [meetingSeries.tenantId],
		references: [saasTenant.id]
	}),
	meetingBookings: many(meetingBooking),
}));

export const meetingParticipantRelations = relations(meetingParticipant, ({one}) => ({
	saasTenant: one(saasTenant, {
		fields: [meetingParticipant.tenantId],
		references: [saasTenant.id]
	}),
	meetingBooking: one(meetingBooking, {
		fields: [meetingParticipant.bookingId],
		references: [meetingBooking.id]
	}),
	iamTenantMember: one(iamTenantMember, {
		fields: [meetingParticipant.memberId],
		references: [iamTenantMember.id]
	}),
}));

export const iamRolePermissionRelations = relations(iamRolePermission, ({one}) => ({
	iamRole: one(iamRole, {
		fields: [iamRolePermission.roleId],
		references: [iamRole.id]
	}),
	iamPermission: one(iamPermission, {
		fields: [iamRolePermission.permissionId],
		references: [iamPermission.id]
	}),
}));

export const iamMemberRoleRelations = relations(iamMemberRole, ({one}) => ({
	iamTenantMember: one(iamTenantMember, {
		fields: [iamMemberRole.memberId],
		references: [iamTenantMember.id]
	}),
	iamRole: one(iamRole, {
		fields: [iamMemberRole.roleId],
		references: [iamRole.id]
	}),
}));

export const meetingRoomFacilityRelations = relations(meetingRoomFacility, ({one}) => ({
	meetingRoom: one(meetingRoom, {
		fields: [meetingRoomFacility.roomId],
		references: [meetingRoom.id]
	}),
	meetingFacility: one(meetingFacility, {
		fields: [meetingRoomFacility.facilityId],
		references: [meetingFacility.id]
	}),
}));