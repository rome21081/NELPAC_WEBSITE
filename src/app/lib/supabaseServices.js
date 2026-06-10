import { supabase } from "./supabaseClient";

function requireSupabase() {
  if (!supabase) throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY.");
  return supabase;
}

async function runQuery(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function compressImageFile(file, { maxWidth = 1600, maxHeight = 1600, quality = 0.82 } = {}) {
  if (!file?.type?.startsWith("image/") || file.type === "image/gif") return file;

  const imageUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = imageUrl;
    });

    const ratio = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
    const width = Math.round(image.width * ratio);
    const height = Math.round(image.height * ratio);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

async function listProfiles() {
  return runQuery(requireSupabase().from("profiles").select("*").order("created_at", { ascending: false }));
}

async function listLocalChurches(filters = {}) {
  let query = requireSupabase().from("local_churches").select("*").order("name");
  if (filters.district) query = query.eq("district", filters.district);
  if (filters.activeOnly) query = query.eq("is_active", true);
  return runQuery(query);
}

async function listMembers() {
  return runQuery(requireSupabase()
    .from("local_church_members_with_church")
    .select("*")
    .order("created_at", { ascending: false }));
}

async function getMyMembers(userId) {
  return runQuery(requireSupabase()
    .from("local_church_members_with_church")
    .select("*")
    .eq("submitted_by", userId)
    .order("created_at", { ascending: false }));
}

async function createMember(payload) {
  const { data, error } = await requireSupabase()
    .from("local_church_members")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function updateMyMemberApplication(memberId, payload) {
  const { data, error } = await requireSupabase().rpc("update_my_member_application", {
    p_member_id: memberId,
    p_local_church_id: payload.local_church_id,
    p_name: payload.name,
    p_birthday: payload.birthday,
    p_contact_number: payload.contact_number || null,
    p_gender: payload.gender || null,
    p_address: payload.address || null,
    p_parent_guardian_name: payload.parent_guardian_name || null,
    p_emergency_contact: payload.emergency_contact || null,
    p_professing_member: payload.professing_member || "No",
    p_confirmation_class_year: payload.confirmation_class_year || null,
    p_confirmation_class_status: payload.confirmation_class_status || "Not Started",
    p_activity_status: payload.activity_status || "Active",
  });
  if (error) throw error;
  return data;
}

async function reviewMember(memberId, status, notes = null) {
  const { data, error } = await requireSupabase().rpc("admin_review_member_application", {
    p_member_id: memberId,
    p_new_status: status,
    p_admin_notes: notes,
  });
  if (error) throw error;
  return data;
}

async function listEvents() {
  return runQuery(requireSupabase().from("events").select("*, local_churches(name)").order("event_date", { ascending: false }));
}

async function saveEvent(event) {
  const client = requireSupabase();
  if (event.id) {
    const { data, error } = await client.from("events").update(event).eq("id", event.id).select("*").single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await client.from("events").insert(event).select("*").single();
  if (error) throw error;
  return data;
}

async function listEvaluationDetails() {
  return runQuery(requireSupabase().from("event_evaluation_details").select("*").order("submitted_at", { ascending: false }));
}

async function listEvaluationAnalytics() {
  return runQuery(requireSupabase().from("event_evaluation_analytics").select("*").order("event_date", { ascending: false }));
}

async function listEvaluationRewardHistory(userId = null) {
  let query = requireSupabase().from("evaluation_reward_history").select("*, events(title), profiles(full_name, email)").order("created_at", { ascending: false });
  if (userId) query = query.eq("user_id", userId);
  return runQuery(query);
}

async function submitEvaluation(payload) {
  const { data, error } = await requireSupabase().rpc("submit_event_evaluation", {
    p_event_id: payload.event_id,
    p_overall_rating: payload.overall_rating,
    p_speaker_rating: payload.speaker_rating,
    p_venue_rating: payload.venue_rating,
    p_program_rating: payload.program_rating,
    p_comment: payload.comment || null,
  });
  if (error) throw error;
  return data;
}

async function listImageSubmissions() {
  return runQuery(
    requireSupabase()
      .from("image_submissions")
      .select("*, events(title), local_churches(name), profiles!image_submissions_submitted_by_fkey(full_name)")
      .order("created_at", { ascending: false })
  );
}

async function uploadImageSubmission({ file, caption, event_id, local_church_id, userId }) {
  const client = requireSupabase();
  const uploadFile = await compressImageFile(file);
  const extension = uploadFile.name.split(".").pop();
  const path = `image-submissions/${userId}/${Date.now()}.${extension}`;
  const { error: uploadError } = await client.storage.from("nelpac-images").upload(path, uploadFile, { upsert: false, contentType: uploadFile.type });
  if (uploadError) {
    if (uploadError.message?.toLowerCase().includes("bucket not found")) {
      throw new Error("Storage bucket not found. Create a public Supabase Storage bucket named nelpac-images, then try again.");
    }
    throw uploadError;
  }
  const { data: publicUrl } = client.storage.from("nelpac-images").getPublicUrl(path);
  const { data, error } = await client
    .from("image_submissions")
    .insert({
      submitted_by: userId,
      event_id: event_id || null,
      local_church_id: local_church_id || null,
      image_url: publicUrl.publicUrl,
      caption,
      status: "Pending",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function uploadStorageImage(bucket, file, folder, userId) {
  const client = requireSupabase();
  const uploadFile = await compressImageFile(file);
  const extension = uploadFile.name.split(".").pop();
  const safeFolder = folder || "uploads";
  const path = `${safeFolder}/${userId}/${Date.now()}.${extension}`;
  const { error } = await client.storage.from(bucket).upload(path, uploadFile, { upsert: false, contentType: uploadFile.type });
  if (error) {
    if (error.message?.toLowerCase().includes("bucket not found")) {
      throw new Error(`Storage bucket not found. Create a Supabase Storage bucket named ${bucket}, then try again.`);
    }
    throw error;
  }
  const { data } = client.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

async function reviewImageSubmission(submissionId, status, notes = null) {
  const { data, error } = await requireSupabase().rpc("admin_review_image_submission", {
    p_submission_id: submissionId,
    p_new_status: status,
    p_admin_notes: notes,
  });
  if (error) throw error;
  return data;
}

async function listPointBalances() {
  return runQuery(requireSupabase().from("one_card_point_balances").select("*").order("full_name"));
}

async function listPointLedger(userId = null) {
  let query = requireSupabase().from("one_card_points").select("*, events(title)").order("created_at", { ascending: false });
  if (userId) query = query.eq("user_id", userId);
  return runQuery(query);
}

async function createPointsEntry(payload) {
  const { data, error } = await requireSupabase().rpc("admin_create_points_entry", {
    p_user_id: payload.user_id,
    p_points: Number(payload.points),
    p_description: payload.description,
    p_entry_type: payload.entry_type || "earned",
    p_event_id: payload.event_id || null,
  });
  if (error) throw error;
  return data;
}

async function listPosts({ publishedOnly = false } = {}) {
  let query = requireSupabase().from("posts_or_announcements").select("*").order("published_at", { ascending: false, nullsFirst: false });
  if (publishedOnly) query = query.eq("status", "Published");
  return runQuery(query);
}

async function savePost(post) {
  const client = requireSupabase();
  const payload = post.status === "Published" && !post.published_at ? { ...post, published_at: new Date().toISOString() } : post;
  if (payload.id) {
    const { data, error } = await client.from("posts_or_announcements").update(payload).eq("id", payload.id).select("*").single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await client.from("posts_or_announcements").insert(payload).select("*").single();
  if (error) throw error;
  return data;
}

async function listRewards({ activeOnly = false } = {}) {
  let query = requireSupabase().from("rewards").select("*").order("required_points");
  if (activeOnly) query = query.eq("is_active", true);
  return runQuery(query);
}

async function saveReward(reward) {
  const client = requireSupabase();
  if (reward.id) {
    const { data, error } = await client.from("rewards").update(reward).eq("id", reward.id).select("*").single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await client.from("rewards").insert(reward).select("*").single();
  if (error) throw error;
  return data;
}

async function submitRewardClaim(rewardId) {
  const { data, error } = await requireSupabase().rpc("submit_reward_claim", { p_reward_id: rewardId });
  if (error) throw error;
  return data;
}

async function listRewardClaims() {
  return runQuery(requireSupabase().from("reward_claims_with_rewards").select("*").order("created_at", { ascending: false }));
}

async function reviewRewardClaim(claimId, status, notes = null) {
  const { data, error } = await requireSupabase().rpc("admin_review_reward_claim", {
    p_claim_id: claimId,
    p_new_status: status,
    p_admin_notes: notes,
  });
  if (error) throw error;
  return data;
}

async function markRewardClaimClaimed(claimId) {
  const { data, error } = await requireSupabase().rpc("admin_mark_reward_claim_claimed", { p_claim_id: claimId });
  if (error) throw error;
  return data;
}

async function listRedeemCodes(userId = null) {
  let query = requireSupabase().from("redeem_codes").select("*").order("created_at", { ascending: false });
  if (userId) query = query.eq("user_id", userId);
  return runQuery(query);
}

async function listOneCardRedeemCodes() {
  return runQuery(requireSupabase()
    .from("one_card_redeem_codes_with_usage")
    .select("*")
    .order("created_at", { ascending: false }));
}

async function saveOneCardRedeemCode(payload) {
  const client = requireSupabase();
  const args = {
    p_code: payload.code,
    p_points: Number(payload.points),
    p_claim_limit: Number(payload.claim_limit),
    p_expires_at: payload.expires_at,
    p_is_active: payload.is_active,
    p_event_id: payload.event_id || null,
  };
  const { data, error } = payload.id
    ? await client.rpc("admin_update_one_card_redeem_code", { p_code_id: payload.id, ...args })
    : await client.rpc("admin_create_one_card_redeem_code", args);
  if (error) throw error;
  return data;
}

async function redeemOneCardCode(code) {
  const { data, error } = await requireSupabase().rpc("redeem_one_card_code", { p_code: code });
  if (error) throw error;
  return data;
}

async function listNotifications(userId = null) {
  let query = requireSupabase().from("notifications").select("*").order("created_at", { ascending: false });
  if (userId) query = query.eq("user_id", userId);
  return runQuery(query);
}

async function markNotificationRead(notificationId) {
  const { data, error } = await requireSupabase().rpc("mark_notification_read", { p_notification_id: notificationId });
  if (error) throw error;
  return data;
}

async function logPasswordResetActivity({ email = null, activityType, success = true, detail = null }) {
  const { data, error } = await requireSupabase().rpc("log_password_reset_activity", {
    p_email: email,
    p_activity_type: activityType,
    p_success: success,
    p_detail: detail,
  });
  if (error) throw error;
  return data;
}

async function listAuditLogs() {
  return runQuery(requireSupabase().from("audit_logs").select("*").order("created_at", { ascending: false }).limit(100));
}

async function updateMyProfile(payload) {
  const { data, error } = await requireSupabase().rpc("update_my_profile", {
    p_full_name: payload.full_name || null,
    p_avatar_url: payload.avatar_url || null,
    p_contact_number: payload.contact_number || null,
  });
  if (error) throw error;
  return data;
}

async function uploadProfileAvatar(file, userId) {
  const client = requireSupabase();
  const uploadFile = await compressImageFile(file, { maxWidth: 900, maxHeight: 900, quality: 0.85 });
  const extension = uploadFile.name.split(".").pop();
  const path = `avatars/${userId}/${Date.now()}.${extension}`;
  const { error } = await client.storage.from("nelpac-images").upload(path, uploadFile, { upsert: true, contentType: uploadFile.type });
  if (error) {
    if (error.message?.toLowerCase().includes("bucket not found")) {
      throw new Error("Storage bucket not found. Create a public Supabase Storage bucket named nelpac-images, then try again.");
    }
    throw error;
  }
  const { data } = client.storage.from("nelpac-images").getPublicUrl(path);
  return data.publicUrl;
}

async function setUserRole(userId, role) {
  const { data, error } = await requireSupabase().rpc("admin_set_user_role", {
    p_user_id: userId,
    p_role: role,
  });
  if (error) throw error;
  return data;
}

export {
  createMember,
  createPointsEntry,
  compressImageFile,
  getMyMembers,
  listAuditLogs,
  listEvents,
  listEvaluationAnalytics,
  listEvaluationDetails,
  listEvaluationRewardHistory,
  listImageSubmissions,
  listLocalChurches,
  listMembers,
  listNotifications,
  listPointBalances,
  listPointLedger,
  listPosts,
  listProfiles,
  listOneCardRedeemCodes,
  listRedeemCodes,
  listRewardClaims,
  listRewards,
  logPasswordResetActivity,
  markNotificationRead,
  markRewardClaimClaimed,
  requireSupabase,
  reviewImageSubmission,
  reviewMember,
  reviewRewardClaim,
  runQuery,
  saveEvent,
  saveOneCardRedeemCode,
  savePost,
  saveReward,
  setUserRole,
  submitEvaluation,
  redeemOneCardCode,
  submitRewardClaim,
  updateMyMemberApplication,
  updateMyProfile,
  uploadProfileAvatar,
  uploadImageSubmission,
  uploadStorageImage,
};
