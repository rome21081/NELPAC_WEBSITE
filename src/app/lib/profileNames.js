const normalizeNamePart = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

function buildFullName(firstName, middleName, lastName) {
  return [firstName, middleName, lastName]
    .map(normalizeNamePart)
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function getProfileDisplayName(profile, fallback = "No name provided.") {
  return (
    normalizeNamePart(profile?.full_name) ||
    normalizeNamePart(profile?.name) ||
    fallback
  );
}

function hasCompleteProfileName(profile) {
  const fullName = normalizeNamePart(profile?.full_name);
  const contactNumber = normalizeNamePart(profile?.contact_number);
  return (
    profile?.name_completed === true &&
    fullName.split(" ").filter(Boolean).length >= 2 &&
    Boolean(contactNumber)
  );
}

export {
  buildFullName,
  getProfileDisplayName,
  hasCompleteProfileName,
  normalizeNamePart,
};
