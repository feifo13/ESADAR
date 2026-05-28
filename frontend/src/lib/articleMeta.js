const GENDER_LABELS = {
  UNISEX: "Unisex",
  HOMBRE: "Hombre",
  MUJER: "Mujer",
  NIÑO: "Niño",
  NIÑA: "Niña",
  OTRO: "Otro",
};

const AGE_GROUP_LABELS = {
  ADULT: "Adulto",
  KIDS: "Kids",
  TODDLER: "Toddler",
  INFANT: "Infant",
  NEWBORN: "Newborn",
};

export function formatArticleGender(value) {
  const key = String(value || "").trim().toUpperCase();
  return GENDER_LABELS[key] || "";
}

export function formatArticleAgeGroup(value) {
  const key = String(value || "").trim().toUpperCase();
  return AGE_GROUP_LABELS[key] || "";
}

export function truncateArticleMeta(value, maxLength = 90) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text || text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}
