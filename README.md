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
| `/e/<date-id>` | Everyone (private: link holders, admins, people signed up) | Event page; signed-in members also see who's singing |
| `/e/p/<token>` | Link holders | Private event link; opens the next date |
| `/g/<slug>` | Everyone | Group page with its public dates |
| `/admin` | Admins | Groups you manage; super users can add groups |
| `/admin/groups/<id>` | Group admins | Events, group details, admins; super users can delete the group |
| `/admin/events/<id>` | Group admins | Event schedule and settings, upcoming dates, private link |
| `/admin/dates/<id>` | Group admins | Settings for one date, cancel or restore it, sign-up list |

A person must sign in once before they can be made a group admin.

## Recurring dates

`src/lib/schedule.ts` turns a series' schedule (one time, weekly, every 2 weeks, or monthly such as "last Sunday") into event dates 8 weeks ahead, in Pacific time. Dates are topped up when an event is saved, when an admin opens its pages, and by a daily Vercel Cron call to `/api/cron/dates`. Saving an event updates future dates nobody has signed up for; dates with sign-ups keep their settings.

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
