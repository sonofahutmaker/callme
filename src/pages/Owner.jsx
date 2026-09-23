import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import {
  cancelSignUp,
  ensureWeek,
  saveAvailability,
  subscribeToNames,
  subscribeToWeek,
} from "../firebase.js";
import {
  CALL_DAYS,
  emptyNames,
  emptyWeekData,
  formatDayLabel,
  useCallWeek,
} from "../week.js";
import Toast from "../components/Toast.jsx";
import WeekStrip from "../components/WeekStrip.jsx";

const QUESTIONS = {
  tue: "Tuesday 5–6pm PT?",
  wed: "Wednesday 5–6pm PT?",
  thu: "Thursday 5–6pm PT?",
};

export default function Owner() {
  const { user, ready, logout } = useAuth();
  const week = useCallWeek();
  const [weekData, setWeekData] = useState(emptyWeekData());
  const [names, setNames] = useState(emptyNames());
  const [draft, setDraft] = useState(emptyWeekData().available);
  const [draftPreferred, setDraftPreferred] = useState(emptyWeekData().preferred);
  const hydrated = useRef(false);
  const pendingTaken = useRef({});
  const [cancelDay, setCancelDay] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.role !== "owner") {
      return undefined;
    }
    let unsubWeek = () => {};
    let unsubNames = () => {};
    ensureWeek(week.weekId)
      .then(() => {
        unsubWeek = subscribeToWeek(week.weekId, (data) => {
          const available = { ...emptyWeekData().available, ...data.available };
          const preferred = { ...emptyWeekData().preferred, ...data.preferred };
          const taken = { ...emptyWeekData().taken, ...data.taken };
          CALL_DAYS.forEach((day) => {
            if (!(day in pendingTaken.current)) {
              return;
            }
            if (taken[day] === pendingTaken.current[day]) {
              delete pendingTaken.current[day];
            } else {
              taken[day] = pendingTaken.current[day];
            }
          });
          setWeekData({
            available,
            preferred,
            taken,
          });
          if (!hydrated.current) {
            hydrated.current = true;
            setDraft(available);
            setDraftPreferred(preferred);
          }
        }, setError);
        unsubNames = subscribeToNames(week.weekId, setNames, setError);
      })
      .catch((err) => setError(err.message));
    return () => {
      unsubWeek();
      unsubNames();
    };
  }, [user, week.weekId]);

  if (!ready) {
    return (
      <main className="page">
        <p>Loading…</p>
      </main>
    );
  }
  if (user?.role !== "owner") {
    return <Navigate to="/" replace />;
  }

  async function onSave(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await saveAvailability(week.weekId, draft, draftPreferred);
      setMessage("Availability saved.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function onCancel() {
    setError("");
    setMessage("");
    try {
      await cancelSignUp(week.weekId, cancelDay);
      pendingTaken.current[cancelDay] = false;
      setWeekData((current) => ({
        ...current,
        taken: { ...current.taken, [cancelDay]: false },
      }));
      setNames((current) => ({ ...current, [cancelDay]: "" }));
      setCancelDay(null);
      setMessage("The call was canceled.");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="page page-schedule">
      <header>
        <div className="top top-single">
          <h1>Your week</h1>
          <button type="button" className="ghost" onClick={logout}>
            Log out
          </button>
        </div>
        <p className="lede">Can you take a call at 5–6pm PT?</p>
      </header>
      <form className="quiz-grid" onSubmit={onSave}>
        {CALL_DAYS.map((day) => (
          <fieldset key={day} className="quiz">
            <legend>{QUESTIONS[day]}</legend>
            <label>
              <input
                type="radio"
                name={day}
                checked={draft[day] === false}
                onChange={() => {
                  setDraft((current) => ({ ...current, [day]: false }));
                  setDraftPreferred((current) => ({ ...current, [day]: false }));
                }}
              />
              Unavailable
            </label>
            <label>
              <input
                type="radio"
                name={day}
                checked={draft[day] === true && draftPreferred[day] === false}
                onChange={() => {
                  setDraft((current) => ({ ...current, [day]: true }));
                  setDraftPreferred((current) => ({ ...current, [day]: false }));
                }}
              />
              Available
            </label>
            <label>
              <input
                type="radio"
                name={day}
                checked={draftPreferred[day] === true}
                onChange={() => {
                  setDraft((current) => ({ ...current, [day]: true }));
                  setDraftPreferred((current) => ({ ...current, [day]: true }));
                }}
              />
              Preferred
            </label>
          </fieldset>
        ))}
        <button type="submit">Save availability</button>
      </form>
      {error ? <p className="error">{error}</p> : null}
      <h2>Who signed up</h2>
      <div className="schedule">
        <WeekStrip
          strip={week.strip}
          available={weekData.available}
          preferred={weekData.preferred}
          taken={weekData.taken}
          names={names}
          showNames
          allowCancelBooked
          onCancel={(day) => {
            setCancelDay(day);
            setError("");
            setMessage("");
          }}
        />
      </div>
      {cancelDay ? (
        <div className="overlay" onClick={() => setCancelDay(null)} role="presentation">
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <p>
              Cancel {names[cancelDay] || "this person"}’s call on{" "}
              {formatDayLabel(week.dates[cancelDay])}?
            </p>
            <div className="actions">
              <button type="button" onClick={onCancel}>
                Cancel call
              </button>
              <button type="button" className="ghost" onClick={() => setCancelDay(null)}>
                Keep call
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <Toast message={message} onDismiss={() => setMessage("")} />
    </main>
  );
}
