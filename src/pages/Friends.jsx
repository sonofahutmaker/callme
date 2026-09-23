import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import { cancelSignUp, ensureWeek, signUpForDay, subscribeToWeek } from "../firebase.js";
import { CALL_DAYS, emptyWeekData, formatDayLabel, useCallWeek } from "../week.js";
import Toast from "../components/Toast.jsx";
import WeekStrip from "../components/WeekStrip.jsx";

const NAME_KEY = "callme-friend-name";

function signupKey(weekId, day) {
  return `callme-signup:${weekId}:${day}`;
}

function loadMySignups(weekId) {
  return Object.fromEntries(
    CALL_DAYS.map((day) => [day, localStorage.getItem(signupKey(weekId, day)) === "true"]),
  );
}

export default function Friends() {
  const { user, ready, logout } = useAuth();
  const week = useCallWeek();
  const [weekData, setWeekData] = useState(emptyWeekData());
  const [mySignups, setMySignups] = useState(() => loadMySignups(week.weekId));
  const [selected, setSelected] = useState(null);
  const [cancelDay, setCancelDay] = useState(null);
  const [name, setName] = useState(() => sessionStorage.getItem(NAME_KEY) || "");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const pendingTaken = useRef({});

  function applyTaken(day, value) {
    pendingTaken.current[day] = value;
    setWeekData((current) => ({
      ...current,
      taken: { ...current.taken, [day]: value },
    }));
  }

  useEffect(() => {
    if (user?.role !== "friends") {
      return undefined;
    }
    let unsub = () => {};
    ensureWeek(week.weekId)
      .then(() => {
        unsub = subscribeToWeek(week.weekId, (data) => {
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
            available: { ...emptyWeekData().available, ...data.available },
            preferred: { ...emptyWeekData().preferred, ...data.preferred },
            taken,
          });
          setMySignups((current) => {
            const next = { ...current };
            CALL_DAYS.forEach((day) => {
              if (pendingTaken.current[day] === true) {
                return;
              }
              if (next[day] && !taken[day]) {
                localStorage.removeItem(signupKey(week.weekId, day));
                next[day] = false;
              }
            });
            return next;
          });
        }, setError);
      })
      .catch((err) => setError(err.message));
    return () => unsub();
  }, [user, week.weekId]);

  if (!ready) {
    return (
      <main className="page">
        <p>Loading…</p>
      </main>
    );
  }
  if (user?.role !== "friends") {
    return <Navigate to="/" replace />;
  }

  async function submitSignUp(day) {
    setError("");
    setMessage("");
    try {
      await signUpForDay(week.weekId, day, name);
      localStorage.setItem(signupKey(week.weekId, day), "true");
      applyTaken(day, true);
      setMySignups((current) => ({ ...current, [day]: true }));
      setMessage("You’re signed up.");
      setSelected(null);
    } catch (err) {
      setError(err.message);
    }
  }

  function onConfirm(event) {
    event.preventDefault();
    submitSignUp(selected);
  }

  async function onCancel() {
    setError("");
    setMessage("");
    try {
      await cancelSignUp(week.weekId, cancelDay);
      localStorage.removeItem(signupKey(week.weekId, cancelDay));
      applyTaken(cancelDay, false);
      setMySignups((current) => ({ ...current, [cancelDay]: false }));
      setCancelDay(null);
      setMessage("Your signup was canceled.");
    } catch (err) {
      setError(err.message);
    }
  }

  function closePrompt() {
    setSelected(null);
    setCancelDay(null);
  }

  return (
    <main className="page page-schedule">
      <header>
        <div className="top">
          <h1>Do you want to call Jenni on her way home from work?</h1>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              sessionStorage.removeItem(NAME_KEY);
              CALL_DAYS.forEach((day) => {
                localStorage.removeItem(signupKey(week.weekId, day));
              });
              logout();
            }}
          >
            Log out
          </button>
        </div>
        <p className="lede">
          Click a day to schedule a call. Jenni will get emailed if you sign up or cancel.
        </p>
        {error ? <p className="error">{error}</p> : null}
      </header>
      <div className="schedule">
        <WeekStrip
          strip={week.strip}
          available={weekData.available}
          preferred={weekData.preferred}
          taken={weekData.taken}
          names={Object.fromEntries(
            CALL_DAYS.map((day) => [day, mySignups[day] ? name : ""]),
          )}
          showNames={false}
          mine={mySignups}
          onSelect={(day) => {
            setCancelDay(null);
            setError("");
            setMessage("");
            if (name.trim()) {
              submitSignUp(day);
            } else {
              setSelected(day);
            }
          }}
          onCancel={(day) => {
            setCancelDay(day);
            setSelected(null);
            setError("");
            setMessage("");
          }}
        />
      </div>
      {selected ? (
        <div className="overlay" onClick={closePrompt} role="presentation">
          <form
            className="modal"
            onSubmit={onConfirm}
            onClick={(event) => event.stopPropagation()}
          >
            <p>Sign up for {formatDayLabel(week.dates[selected])} at 5–6pm PT.</p>
            <label htmlFor="name">Your name</label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                sessionStorage.setItem(NAME_KEY, event.target.value);
              }}
            />
            <div className="actions">
              <button type="submit" disabled={!name.trim()}>
                Confirm
              </button>
              <button type="button" className="ghost" onClick={closePrompt}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}
      {cancelDay ? (
        <div className="overlay" onClick={closePrompt} role="presentation">
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <p>Cancel your call on {formatDayLabel(week.dates[cancelDay])}?</p>
            <div className="actions">
              <button type="button" onClick={onCancel}>
                Unsign up
              </button>
              <button type="button" className="ghost" onClick={closePrompt}>
                Keep my call
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <Toast message={message} onDismiss={() => setMessage("")} />
    </main>
  );
}
