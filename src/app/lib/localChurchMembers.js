import {
  createMember,
  listMembers,
  reviewMember,
  updateMyMemberApplication,
} from "./supabaseServices";

const activityStatusColors = {
  Active: "bg-emerald-100 text-emerald-700",
  Inactive: "bg-slate-100 text-slate-600",
};

const professingMemberColors = {
  Yes: "bg-blue-100 text-blue-700",
  No: "bg-amber-100 text-amber-700",
};

const confirmationStatusColors = {
  Completed: "bg-emerald-100 text-emerald-700",
  Ongoing: "bg-blue-100 text-blue-700",
  "Not Started": "bg-slate-100 text-slate-600",
  Dropped: "bg-red-100 text-red-700",
};

const verificationColors = {
  Pending: "bg-amber-100 text-amber-700",
  Approved: "bg-emerald-100 text-emerald-700",
  Rejected: "bg-red-100 text-red-700",
};

function normalizeMember(member) {
  return {
    ...member,
    computedAge: member.computed_age,
    contactNumber: member.contact_number,
    emergencyContact: member.emergency_contact,
    parentGuardianName: member.parent_guardian_name,
    localChurchId: member.local_church_id,
    localChurch: member.local_church_name,
    professingMember: member.professing_member,
    confirmationClassYear: member.confirmation_class_year,
    confirmationClassStatus: member.confirmation_class_status,
    activityStatus: member.activity_status,
    reviewStatus: member.review_status,
    verificationStatus: member.review_status,
    submittedById: member.submitted_by,
    dateSubmitted: member.created_at?.slice(0, 10) || "",
  };
}

function memberToInsertPayload(member, userId) {
  return {
    submitted_by: userId,
    local_church_id: member.localChurchId || member.local_church_id,
    name: member.name,
    birthday: member.birthday,
    contact_number: member.contactNumber || member.contact_number || null,
    gender: member.gender || null,
    address: member.address || null,
    parent_guardian_name: member.parentGuardianName || member.parent_guardian_name || null,
    emergency_contact: member.emergencyContact || member.emergency_contact || null,
    professing_member: member.professingMember || member.professing_member || "No",
    confirmation_class_year: member.confirmationClassYear || member.confirmation_class_year || null,
    confirmation_class_status: member.confirmationClassStatus || member.confirmation_class_status || "Not Started",
    activity_status: member.activityStatus || member.activity_status || "Active",
  };
}

async function fetchLocalChurchMembers() {
  const data = await listMembers();
  return data.map(normalizeMember);
}

async function createLocalChurchMember(member, userId) {
  return createMember(memberToInsertPayload(member, userId));
}

async function saveMyMemberApplication(memberId, member) {
  return updateMyMemberApplication(memberId, memberToInsertPayload(member));
}

async function updateLocalChurchMember(id, updates) {
  const status = updates.reviewStatus || updates.verificationStatus;
  if (!status) return fetchLocalChurchMembers();
  await reviewMember(id, status);
  return fetchLocalChurchMembers();
}

export {
  activityStatusColors,
  confirmationStatusColors,
  createLocalChurchMember,
  fetchLocalChurchMembers,
  memberToInsertPayload,
  normalizeMember,
  professingMemberColors,
  saveMyMemberApplication,
  updateLocalChurchMember,
  verificationColors,
};
