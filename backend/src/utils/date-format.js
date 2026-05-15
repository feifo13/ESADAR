export const URUGUAY_TIME_ZONE = "America/Montevideo";

const formatterCache = new Map();

function getDateTimeFormatter(locale, timeZone) {
  const key = `${locale}:${timeZone}`;
  if (!formatterCache.has(key)) {
    formatterCache.set(
      key,
      new Intl.DateTimeFormat(locale, {
        timeZone,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    );
  }

  return formatterCache.get(key);
}

export function formatDateTimePartsInTimeZone(
  value,
  { locale = "es-UY", timeZone = URUGUAY_TIME_ZONE } = {},
) {
  if (!value) return { date: "-", time: "-" };

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "-", time: "-" };

  const parts = getDateTimeFormatter(locale, timeZone)
    .formatToParts(date)
    .reduce((accumulator, part) => {
      if (part.type !== "literal") accumulator[part.type] = part.value;
      return accumulator;
    }, {});

  const hour = parts.hour === "24" ? "00" : parts.hour;

  return {
    date: `${parts.day}/${parts.month}/${parts.year}`,
    time: `${hour}:${parts.minute} hs`,
  };
}
