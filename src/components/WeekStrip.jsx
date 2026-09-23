import { formatDayLabel } from "../week.js";

export default function WeekStrip({
  strip,
  available,
  preferred = {},
  taken,
  names,
  showNames,
  mine = {},
  onSelect,
  onCancel,
  allowCancelBooked = false,
}) {
  return (
    <ol className="strip">
      {strip.map((day) => {
        const callDay = day.isCallDay;
        const open = callDay && available[day.key] && !taken[day.key] && !day.isPast;
        const booked = callDay && taken[day.key];
        const mineBooked = booked && mine[day.key] && !day.isPast;
        const cancelableBooked =
          booked && !day.isPast && Boolean(onCancel) && (allowCancelBooked || mineBooked);
        const closed = callDay && (!available[day.key] || day.isPast);
        let status = "Off";
        if (day.isPast && callDay) {
          status = "Unavailable";
        } else if (open) {
          status = preferred[day.key] ? "Preferred by Jenni" : "Open";
        } else if (mineBooked) {
          status = names[day.key] || "Your call";
        } else if (booked) {
          status = showNames && names[day.key] ? names[day.key] : "Unavailable";
        } else if (closed) {
          status = "Unavailable";
        }
        const clickable = Boolean((onSelect && open) || cancelableBooked);
        const Tag = clickable ? "button" : "div";
        return (
          <li key={day.key}>
            <Tag
              type={clickable ? "button" : undefined}
              role={clickable ? undefined : "group"}
              className={[
                "strip-day",
                callDay ? "call" : "other",
                open ? "open" : "",
                open && preferred[day.key] ? "preferred" : "",
                booked ? "taken" : "",
                mineBooked ? "mine" : "",
                closed ? "closed" : "",
                day.isToday ? "today" : "",
                day.isPast ? "past" : "",
              ].join(" ")}
              onClick={
                clickable
                  ? () => {
                      if (cancelableBooked) {
                        onCancel(day.key);
                      } else if (open && onSelect) {
                        onSelect(day.key);
                      }
                    }
                  : undefined
              }
            >
              <span className="strip-wd">{formatDayLabel(day.iso)}</span>
              <span className="strip-status">{status}</span>
              {callDay ? <span className="strip-time">5–6pm PT</span> : null}
            </Tag>
          </li>
        );
      })}
    </ol>
  );
}
