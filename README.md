# Bay Area Desi Karaoke

A responsive site where Bay Area karaoke groups publish recurring events and people sign up to sing or listen.

Stack: Next.js (App Router, TypeScript, Tailwind), Auth.js with Google sign-in, Postgres through Prisma, hosted on Vercel.

## Roles

| Role | How it's set |
| --- | --- |
| Visitor | Not signed in. Sees the public dashboard. |
| Member | Anyone signed in with Google. Signs up per event as a **singer** or **listener**. |
| Group admin | A `GroupAdmin` row linking the user to a group. Powers apply to that group only. |
| Super user | `User.isSuperUser`. Everything, for every group. Emails in `SUPER_USER_EMAILS` are promoted on sign-in. |

Server-side checks live in `src/lib/roles.ts` (`requireViewer`, `requireGroupAdmin`, `requireSuperUser`, `canAdminGroup`).

## Pages

| Path | Who | What |
| --- | --- | --- |
| `/` | Everyone | Upcoming public event dates |
| `/e/<date-id>` | Everyone (private: link holders, admins, people signed up) | Event page; signed-in members sign up, pay, pick songs and see who's singing |
| `/me` | Members | My events: their sign-ups with status and songs |
| `/e/p/<token>` | Link holders | Private event link; opens the next date |
| `/g/<slug>` | Everyone | Group page with its public dates |
| `/admin` | Admins | Groups you manage; super users can add groups |
| `/admin/groups/<id>` | Group admins | Events, group details, admins; super users can delete the group |
| `/admin/events/<id>` | Group admins | Event schedule and settings, upcoming dates, private link |
| `/admin/dates/<id>` | Group admins | Settings for one date, cancel or restore it, payment review, add people by hand |

A person must sign in once before they can be made a group admin.

**View as.** Admins get a "View site as" switch under the header. Super users can view the site as the admin of any one group or as a singer; group admins can view it as a singer (or as the admin of one of their groups, if they run several). It only narrows what the person can do, and is re-checked against their real roles on every request (`getViewer` in `src/lib/roles.ts`), so it can never grant access. "Back to my view" restores their own roles.

## Recurring dates

`src/lib/schedule.ts` turns a series' schedule (one time, weekly, every 2 weeks, or monthly such as "last Sunday") into event dates 8 weeks ahead, in Pacific time. Dates are topped up when an event is saved, when an admin opens its pages, and by a daily Vercel Cron call to `/api/cron/dates`. Saving an event updates future dates nobody has signed up for; dates with sign-ups keep their settings. Admins can also change a single date: reschedule it (it keeps a link to its original slot in `originalStartsAt`, so the schedule doesn't add it back), delete it (kept as a hidden `DELETED` row for the same reason), set its theme (optional, and either required for songs or just a suggestion), and open or close its sign-ups (`signupsOpen`).

## Sign-ups

`src/lib/signups.ts` holds the rules; member actions are in `src/app/e/[dateId]/actions.ts` and admin actions in `src/app/admin/signup-actions.ts`.

- A member picks singer or listener. A paid spot is **Reserved** for 24 hours and the page shows the group's Zelle details, the amount and a memo code (`BADK-XXXX`). A free spot is confirmed at once. When a role is full they join its waitlist instead.
- Uploading a payment screenshot moves the sign-up to **Payment under review** and holds the spot until an admin decides. Admins approve, reject with a reason (the person gets 24 hours to upload a new one), or cancel.
- Screenshots are stored in Postgres (`PaymentScreenshot`) rather than a file service, so there is nothing else to set up and they stay private: `/api/screenshots/<sign-up-id>` serves one only to its uploader and that group's admins. The page shrinks photos to a JPEG before upload, and uploads are capped at 4 MB (Vercel's request limit is 4.5 MB).
- Overdue holds expire, and freed spots go to the next person on that role's waitlist, whenever the event page or its admin page is opened, and in the daily cron as a backstop (`settleDate`). Every change to who holds a spot runs under a per-date Postgres advisory lock, so two people can't both take the last spot.
- Singers pick one song per round, until sign-ups close (the date's start). Admins can reject a song with a reason; songs added after a payment was approved are marked "New song".
- Admins can add people by hand (confirmed at once, with an optional payment note). Going over a cap needs a tick. If an email is given, the sign-up joins that person's account when they sign in with Google.
- Emails are not sent yet; they come in the next step.

## Data model

`prisma/schema.prisma` follows the product spec: User, Group, GroupAdmin, EventSeries, EventDate, SignUp, Song (plus Auth.js's Account, Session and VerificationToken). Rules from the spec that the database enforces:

- Singers and listeners have separate optional caps (`maxSingers`, `maxListeners`); when a role is full, new sign-ups get `WAITLISTED`, ordered by `waitlistedAt`.
- One sign-up per account per event date (no guests).
- Each singer has up to two songs per event date, one per round (`Song.round` is 1 or 2).
- First pick wins: a song title or YouTube video can be held by only one active pick per event date, across both rounds (partial unique indexes in the first migration).
- `SignUp.registeredAt` records when someone signed up; `Song.enteredAt` is the song time, and song priority goes by it. Changing a song's title releases the old row and creates a new one with a fresh time (earlier picks are kept as history); editing only the YouTube link or artist keeps the original time.

## Running locally

```bash
cp .env.example .env      # fill in the values
npm install
npx prisma migrate dev    # creates the tables
npm run dev               # http://localhost:3000
```

For Google sign-in locally, add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI on the OAuth client.

## Environment variables

| Name | What it is |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `AUTH_SECRET` | Random secret for sessions (`npx auth secret`) |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth client |
| `SUPER_USER_EMAILS` | Comma-separated emails that become super users |
| `CRON_SECRET` | Optional; when set, `/api/cron/dates` only accepts Vercel Cron's calls |

## Deploying

Vercel runs `npm run vercel-build`, which applies pending migrations (`prisma migrate deploy`) before building. Migrations use `DATABASE_URL_UNPOOLED` when it is set (Neon's direct connection; the Neon Vercel integration sets it), otherwise `DATABASE_URL`.

## Sample data

`prisma/demo-data.sql` adds a demo group with the next four Saturday events, so the dashboard has something to show. Paste it into your database's SQL editor (Neon: SQL Editor) or run `psql "$DATABASE_URL" -f prisma/demo-data.sql`. It is safe to run more than once.
