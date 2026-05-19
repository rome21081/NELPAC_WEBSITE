import { listLocalChurches } from "./supabaseServices";

async function getActiveLocalChurchesByDistrict(district) {
  if (!district) return [];
  return listLocalChurches({ district, activeOnly: true });
}

export {
  getActiveLocalChurchesByDistrict,
};
