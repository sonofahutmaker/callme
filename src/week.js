import { useEffect, useState } from "react";

const TZ = "America/Los_Angeles";
const SLOT_END_HOUR = 18;
const DAYS_SINCE_FRIDAY = {
  Fri: 0,
  Sat: 1,
  Sun: 2,
  Mon: 3,
  Tue: 4,
  Wed: 5,
  Thu: 6,
};

const STRIP_KEYS = ["tue", "wed", "thu"];
export const CALL_DAYS = ["tue", "wed", "thu"];

export function pacificDateParts(date = new Date()) {
  const parts = {};
  for (const part of new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date)) {
    if (part.type !== "literal") {
      parts[part.type] = part.value;
    }
  }
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    weekday: parts.weekday,
    hour: Number(parts.hour),
    iso: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

export function isSlotPast(isoDate, now = new Date()) {
  const current = pacificDateParts(now);
  if (isoDate < current.iso) {
    return true;
  }
  if (isoDate > current.iso) {
    return false;
  }
  return current.hour >= SLOT_END_HOUR;
}

export function addIsoDays(isoDate, days) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

export function getCallWeek(now = new Date()) {
  const today = pacificDateParts(now);
  const offset = DAYS_SINCE_FRIDAY[today.weekday];
  if (offset === undefined) {
    throw new Error(`Unexpected weekday: ${today.weekday}`);
  }
  const friday = addIsoDays(today.iso, -offset);
  const dates = {
    sun: addIsoDays(friday, 2),
    mon: addIsoDays(friday, 3),
    tue: addIsoDays(friday, 4),
    wed: addIsoDays(friday, 5),
    thu: addIsoDays(friday, 6),
    fri: addIsoDays(friday, 7),
    sat: addIsoDays(friday, 8),
  };
  return {
    weekId: friday,
    todayIso: today.iso,
    dates,
    strip: STRIP_KEYS.map((key) => ({
      key,
      iso: dates[key],
      isCallDay: CALL_DAYS.includes(key),
      isPast: isSlotPast(dates[key], now),
      isToday: dates[key] === today.iso,
    })),
  };
}

export function formatDayLabel(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day, 12));
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(utc);
}

export function useCallWeek() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(id);
  }, []);
  return getCallWeek(now);
}

export function emptyWeekData() {
  return {
    available: { tue: false, wed: false, thu: false },
    preferred: { tue: false, wed: false, thu: false },
    taken: { tue: false, wed: false, thu: false },
  };
}

export function emptyNames() {
  return { tue: "", wed: "", thu: "" };
}
