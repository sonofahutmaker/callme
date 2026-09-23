const {
  onDocumentCreated,
  onDocumentDeleted,
} = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");

const brevoApiKey = defineSecret("BREVO_API_KEY");
const ownerEmail = defineSecret("OWNER_NOTIFICATION_EMAIL");
const senderEmail = defineSecret("BREVO_SENDER_EMAIL");

const dayOffsets = {
  tue: 4,
  wed: 5,
  thu: 6,
};

function formatCallDate(weekId, day) {
  const [year, month, date] = weekId.split("-").map(Number);
  const callDate = new Date(Date.UTC(year, month - 1, date + dayOffsets[day], 12));
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(callDate);
}

async function sendEmail(subject, textContent) {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": brevoApiKey.value(),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: {
        name: "Call Me",
        email: senderEmail.value(),
      },
      to: [{ email: ownerEmail.value() }],
      subject,
      textContent,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Brevo email failed (${response.status}): ${details}`);
  }
}

exports.notifyOwnerOfSignup = onDocumentCreated(
  {
    document: "weeks/{weekId}/private/{day}",
    secrets: [brevoApiKey, ownerEmail, senderEmail],
  },
  async (event) => {
    const booking = event.data?.data();
    const { weekId, day } = event.params;

    if (!booking?.name || !(day in dayOffsets)) {
      return;
    }

    const callDate = formatCallDate(weekId, day);
    await sendEmail(
      `${booking.name} signed up to call`,
      `${booking.name} signed up to call you on ${callDate} from 5–6pm PT.`,
    );
  },
);

exports.remindOwnerToSetAvailability = onSchedule(
  {
    schedule: "0 10 * * 0",
    timeZone: "America/Los_Angeles",
    secrets: [brevoApiKey, ownerEmail, senderEmail],
  },
  async () => {
    await sendEmail(
      "Set your Call Me availability",
      "It's Sunday. Fill in Tuesday, Wednesday, and Thursday so friends can book 5–6pm PT this week.\n\nhttps://callme.jennihutson.com/",
    );
  },
);

exports.notifyOwnerOfCancellation = onDocumentDeleted(
  {
    document: "weeks/{weekId}/private/{day}",
    secrets: [brevoApiKey, ownerEmail, senderEmail],
  },
  async (event) => {
    const booking = event.data?.data();
    const { weekId, day } = event.params;

    if (!booking?.name || !(day in dayOffsets)) {
      return;
    }

    const callDate = formatCallDate(weekId, day);
    await sendEmail(
      `${booking.name}'s call was canceled`,
      `The call with ${booking.name} on ${callDate} from 5–6pm PT was canceled.`,
    );
  },
);
