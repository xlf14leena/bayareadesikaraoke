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

## Deploying

Vercel runs `npm run vercel-build`, which applies pending migrations (`prisma migrate deploy`) before building. Migrations use `DATABASE_URL_UNPOOLED` when it is set (Neon's direct connection; the Neon Vercel integration sets it), otherwise `DATABASE_URL`.

## Sample data

`prisma/demo-data.sql` adds a demo group with the next four Saturday events, so the dashboard has something to show. Paste it into your database's SQL editor (Neon: SQL Editor) or run `psql "$DATABASE_URL" -f prisma/demo-data.sql`. It is safe to run more than once.
