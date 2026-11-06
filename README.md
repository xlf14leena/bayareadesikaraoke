# Karaoke Adda

A responsive site where local karaoke groups publish recurring events and people sign up to sing or listen.

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
| `/g/<group-slug>/<YYYY-MM-DD>-<title>` | Everyone (private: link holders, admins, people signed up) | Event page; signed-in members sign up, pay, pick songs and see who's singing |
| `/me` | Members | My events: their sign-ups with status and songs |
| `/e/p/<token>` | Link holders | Private event link; opens the next date |
| `/g/<slug>` | Everyone | Group page with its public dates |
| `/admin` | Admins | Groups you manage; super users can add groups |
| `/admin/groups/<id>` | Group admins | Events, group details, admins; super users can delete the group |
| `/admin/events/<id>` | Group admins | Event schedule and settings, upcoming dates, private link |
| `/admin/dates/<id>` | Group admins | Settings for one date, cancel or restore it, payment review, add people by hand, check-in |
| `/admin/dates/<id>/checkin` | Group admins | Check-in screen for the venue: rotating QR code and latest arrivals |
| `/checkin/<id>` | Members | Where a guest lands after scanning the venue QR code |

A person must sign in once before they can be made a group admin.

**Group thumbnails.** Group details has an optional square **Thumbnail image** beside the banner (uploaded or pasted, stored like banners). It is the group's picture in event lists (home page, group page) and the admin group list. Without one, `thumbnailFor` in `src/lib/group-thumbnail.ts` shows a tile with the group's initials, in a site color that stays the same for that group.

**View as.** Admins get a "View site as" switch under the header. Super users can view the site as the admin of any one group or as a singer; group admins can view it as a singer (or as the admin of one of their groups, if they run several). It only narrows what the person can do, and is re-checked against their real roles on every request (`getViewer` in `src/lib/roles.ts`), so it can never grant access. "Back to my view" restores their own roles.

## Recurring dates

`src/lib/schedule.ts` turns a series' schedule (one time, weekly, every 2 weeks, or monthly such as "last Sunday") into event dates 4 weeks ahead, in Pacific time. Dates are topped up when an event is saved, when an admin opens its pages, and by a daily Vercel Cron call to `/api/cron/dates`. Saving an event updates future dates nobody has signed up for; dates with sign-ups keep their settings. Admins can also change a single date: reschedule it (it keeps a link to its original slot in `originalStartsAt`, so the schedule doesn't add it back), delete it (kept as a hidden `DELETED` row for the same reason), change its rounds, each with an optional theme (either required for songs or just a suggestion), and open or close its sign-ups (`signupsOpen`).

## Sign-ups

`src/lib/signups.ts` holds the rules; member actions are in `src/app/g/[slug]/[event]/actions.ts` and admin actions in `src/app/admin/signup-actions.ts`.

- A member picks singer or listener. A paid spot is **Reserved** for 24 hours and the page shows the group's Zelle details, the amount and a memo code (`BADK-XXXX`). A free spot is confirmed at once. When a role is full they join its waitlist instead.
- Uploading a payment screenshot moves the sign-up to **Payment under review** and holds the spot until an admin decides. Admins approve, reject with a reason (the person gets 24 hours to upload a new one), or cancel.
- Screenshots are stored in Postgres (`PaymentScreenshot`) rather than a file service, so there is nothing else to set up and they stay private: `/api/screenshots/<sign-up-id>` serves one only to its uploader and that group's admins. The page shrinks photos to a JPEG before upload, and uploads are capped at 4 MB (Vercel's request limit is 4.5 MB).
- Overdue holds expire, and freed spots go to the next person on that role's waitlist, whenever the event page or its admin page is opened, and in the daily cron as a backstop (`settleDate`). Every change to who holds a spot runs under a per-date Postgres advisory lock, so two people can't both take the last spot.
- Singers pick one song per round. When songs lock is an event setting each date can override (`songsOpen` in `src/lib/signups.ts`): **when each round starts** (the default: a round locks once an admin starts it or marks someone in it as singing, and rounds never started lock when the event ends), **when check-in opens**, or **at the start time**. Duet partners can accept or back out until the duet's round locks. Admins can reject a song with a reason; songs added after a payment was approved are marked "New song".
- Admins can add people by hand (confirmed at once, with an optional payment note). Going over a cap needs a tick. If an email is given, the sign-up joins that person's account when they sign in with Google.
- **Song lengths.** Each song's YouTube track length is looked up with the YouTube Data API (`src/lib/youtube.ts`, needs `YOUTUBE_API_KEY`) when the song is saved, and stored on `Song.durationSeconds`. The daily cron and opening a date's admin page fill in any song not looked up yet (songs picked before this, or a lookup that failed). A private or deleted video is asked about once and then shows no length; changing a song's link looks it up again. Lengths show on the song form (as soon as a link is pasted, via `/api/youtube/length`), the singer's own songs, Who's coming, both running orders (the admin one with each round's total and the track time left in the round being sung), and the admin Singers tile as the total for the night. A track longer than 6 minutes (`LONG_TRACK_SECONDS` in `src/lib/format.ts`) shows its length in red everywhere, and the song form warns the singer to be ready to cut it short (they can still save it).
- Emails are not sent yet; they come in the next step.

## Check-in at the venue

`src/lib/checkin.ts` holds the rules; admin actions are in `src/app/admin/checkin-actions.ts`.

- From an hour before a date starts until it ends, the date's admin page shows **Open check-in**. Opening it gives the date a fresh secret (`EventDate.checkInSecret`); **Close check-in** clears it.
- **Show check-in screen** opens a page to put up at the venue. Its QR code holds a code signed with `AUTH_SECRET` and that secret, and changes every 30 seconds. A code is accepted for at most a minute, so a photo sent to someone at home is useless by the time they try it, and closing or reopening check-in voids every earlier code.
- A guest scans it with their phone camera. `/checkin/<id>/scan` checks the code and leaves a single-use pass cookie valid for 10 minutes (time to sign in with Google), then `/checkin/<id>` checks them in. `SignUp.checkedInAt` is the server's time, never the phone's. Anyone holding a spot can check in (paid or still paying; the admin list shows which), once.
- The admin page lists who has checked in, when, and whether they scanned or were checked in by hand, refreshing every 10 seconds while check-in is open. Admins can undo a check-in or check someone in by hand.
- **Singing slots.** Each round has its own way of giving checked-in singers their place in the running order (see **Rounds** below; defaults: round 1 pick, round 2 check-in order). In a pick round a singer chooses any free slot from 1 to the number of singers holding a spot, and can move to another free one. In a check-in-order round each singer who checks in goes after the last slot handed out. In a payment-order round each singer who checks in gets their place in the payment order (1 = paid first): the time they sent the approved payment screenshot, or for free spots and people an admin added or marked paid, when the spot was confirmed; anyone still awaiting approval goes last. A no-show leaves a gap, which "Next singer" skips. A singer who checks in after "now singing" has reached or passed their place goes to the end of that round; one whose place is still ahead keeps it. Slots live in `RoundSlot` (one singer per slot, one slot per singer per round; `src/lib/slots.ts`) and are freed when a check-in is undone or a sign-up ends. Admins see the running order on the date page and can free a picked slot. Once anyone has a slot, the event page shows signed-in people a **Running order** for each round, by slot, with a link to each singer's track; it refreshes every 20 seconds until the event ends. Rounds are stacked collapsible sections. Admins mark who is singing from the date page (**Next singer**, **Back**, **Sing now** on a row, **Stop**; `EventDate.nowRound` / `nowSlot`); **Start round 2** jumps to a round's first taken slot. A round counts as started once "now singing" is in it: from then on, nobody can pick or be given a slot at or below the current number (if the first singer is #7, slots 1 to 6 are gone, and as many slots are added at the end), and once round 2 starts, round 1 hands out no more slots. The event page then shows "Now singing" with the round and number, opens that round, and tells a signed-in singer how many singers are before them.
- There is no location check: venues are stored as an address without coordinates, and phone location is easy to fake and unreliable indoors.

## Data model

`prisma/schema.prisma` follows the product spec: User, Group, GroupAdmin, EventSeries, EventDate, SignUp, Song (plus Auth.js's Account, Session and VerificationToken). Rules from the spec that the database enforces:

- Singers and listeners have separate optional caps (`maxSingers`, `maxListeners`); when a role is full, new sign-ups get `WAITLISTED`, ordered by `waitlistedAt`.
- One sign-up per account per event date (no guests).
- **Rounds.** Each event sets how many rounds its dates have (1 to 6), and for each round whether songs are solos only, duets only, or either (the singer chooses), and its singing order (singer picks a slot, check-in order or payment order). They live in `EventSeries.rounds` as JSON (`src/lib/rounds.ts`), under "Rounds" in the event settings. A date can set its own under "Rounds" in its settings (`EventDate.rounds`, with `"rounds"` in `overrides`). Events from before this keep two solo-or-duet rounds with their old slot modes. Rounds can't be removed while an upcoming date has songs or slots in them. Changing a round to check-in or payment order gives slots right away to singers already checked in. A round with duets can also limit **times per singer**: how many times one person sings in that round, counting their own song and every duet that names them as partner (blank means no limit). Once someone is at the limit, the duet partner picker greys them out and they can't add their own song for that round; the server checks the same rule when songs are saved (`setSong` in `src/lib/signups.ts`). Songs already saved before a limit was set or lowered stay. A singer who names a duet partner asks them: the partner sees the ask on the event page and can **Accept** or **Decline** (and later **Back out**) until sign-ups close (`Song.duetStatus`: `PENDING`, `ACCEPTED`, `DECLINED`; `respondToDuet` in the event page actions). Picking a new partner or a new song asks again. The partner's name shows in the line-up and running order only once they accept. A pending ask counts toward times per singer; a declined one doesn't. Duets that named a partner before this count as accepted.
- **Zelle details.** Each event sets the Zelle recipient name and email or phone that members pay (`EventSeries.zelleName` / `zelleHandle`). A date can set its own under "Zelle details" (`"zelle"` in `overrides`). A new event starts with the group's latest Zelle details.
- **Group links.** A group can add its website, Facebook page and Instagram page in its settings; they show as icon links under the name on the group page.
- Each singer has up to one song per round of the event date (`Song.round` is 1, 2, 3...).
- First pick wins: a song title or YouTube video can be held by only one active pick per event date, across all rounds (partial unique indexes in the first migration).
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
| `YOUTUBE_API_KEY` | Optional; a YouTube Data API v3 key for song lengths. Without it songs show no length |

## Deploying

Vercel runs `npm run vercel-build`, which applies pending migrations (`prisma migrate deploy`) before building. Migrations use `DATABASE_URL_UNPOOLED` when it is set (Neon's direct connection; the Neon Vercel integration sets it), otherwise `DATABASE_URL`.

## Sample data

`prisma/demo-data.sql` adds a demo group with the next four Saturday events, so the dashboard has something to show. Paste it into your database's SQL editor (Neon: SQL Editor) or run `psql "$DATABASE_URL" -f prisma/demo-data.sql`. It is safe to run more than once.
