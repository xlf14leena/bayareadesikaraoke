import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { isConfiguredSuperUser } from "@/lib/roles";

/**
 * Sign-ups an admin added by hand with this email address join the person's
 * account when they sign in, so they show in My events (spec: "Admin-added people").
 */
async function linkAddedSignUps(userId: string, email: string) {
  const unlinked = await prisma.signUp.findMany({
    where: { userId: null, email: { equals: email, mode: "insensitive" } },
    select: { id: true, eventDateId: true },
  });
  for (const s of unlinked) {
    const taken = await prisma.signUp.findUnique({
      where: { eventDateId_userId: { eventDateId: s.eventDateId, userId } },
      select: { id: true },
    });
    if (!taken) await prisma.signUp.update({ where: { id: s.id }, data: { userId } });
  }
}

// Google sign-in. Reads AUTH_SECRET, AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET from the environment.
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [Google],
  session: { strategy: "database" },
  pages: { signIn: "/signin" },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      session.user.isSuperUser = user.isSuperUser;
      return session;
    },
  },
  events: {
    // The first super users come from SUPER_USER_EMAILS; promote them on sign-in.
    async signIn({ user }) {
      if (user.id && isConfiguredSuperUser(user.email) && !user.isSuperUser) {
        await prisma.user.update({ where: { id: user.id }, data: { isSuperUser: true } });
      }
      if (user.id && user.email) await linkAddedSignUps(user.id, user.email);
    },
  },
});
