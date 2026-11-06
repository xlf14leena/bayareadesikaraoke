// Duets in the running order. Every checked-in singer gets a slot in each
// round (src/lib/slots.ts), but an accepted duet is sung once by both. So when
// a singer's only part in a round is someone else's accepted duet, the two
// slots become one turn: the earlier of the two slots, shown as
// "Owner & Partner". The later slot is skipped by "Next singer".
// A partner who also has their own song in the round keeps their own slot.

type Slot = { round: number; slot: number; signUpId: string };
export type TurnSong = {
  signUpId: string;
  round: number;
  duet: boolean;
  duetStatus: string | null;
  duetPartnerId: string | null;
};

/** A turn in the running order: one slot, plus the two singers when it is a merged duet. */
export type Turn<T extends Slot> = T & { pair: { ownerId: string; partnerId: string } | null };

/**
 * The running order's turns, from the taken slots and the date's active songs.
 * Slots stay in their order; a merged duet keeps the earlier slot of the two.
 */
export function duetTurns<T extends Slot>(slots: T[], songs: TurnSong[]): Turn<T>[] {
  const slotOf = (round: number, signUpId: string) => slots.find((s) => s.round === round && s.signUpId === signUpId);
  const hasOwnSong = (round: number, signUpId: string) => songs.some((s) => s.round === round && s.signUpId === signUpId);
  const dropped = new Set<T>();
  const pairs = new Map<T, { ownerId: string; partnerId: string }>();
  const merged = new Set<string>(); // round:signUpId already in a merged turn
  for (const song of songs) {
    if (!song.duet || song.duetStatus !== "ACCEPTED" || !song.duetPartnerId) continue;
    const { round, signUpId: ownerId, duetPartnerId: partnerId } = song;
    if (partnerId === ownerId || hasOwnSong(round, partnerId)) continue;
    if (merged.has(`${round}:${ownerId}`) || merged.has(`${round}:${partnerId}`)) continue;
    const mine = slotOf(round, ownerId);
    const theirs = slotOf(round, partnerId);
    if (!mine || !theirs) continue;
    const [kept, gone] = mine.slot <= theirs.slot ? [mine, theirs] : [theirs, mine];
    pairs.set(kept, { ownerId, partnerId });
    dropped.add(gone);
    merged.add(`${round}:${ownerId}`).add(`${round}:${partnerId}`);
  }
  return slots.filter((s) => !dropped.has(s)).map((s) => ({ ...s, pair: pairs.get(s) ?? null }));
}

/** "Madhu Smita & Leena Shah" for a merged duet (song owner first), otherwise the slot holder's name. */
export function turnName(turn: { signUpId: string; pair: { ownerId: string; partnerId: string } | null }, nameOf: (id: string) => string) {
  return turn.pair ? `${nameOf(turn.pair.ownerId)} & ${nameOf(turn.pair.partnerId)}` : nameOf(turn.signUpId);
}

/** The signUp whose song is sung in this turn: the duet's owner, or the slot holder. */
export function turnSinger(turn: { signUpId: string; pair: { ownerId: string } | null }) {
  return turn.pair?.ownerId ?? turn.signUpId;
}
