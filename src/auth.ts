import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { isConfiguredSuperUser } from "@/lib/roles";

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
    },
  },
});
