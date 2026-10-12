import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    isSuperUser?: boolean;
  }
  interface Session {
    user: { id: string; isSuperUser: boolean } & DefaultSession["user"];
  }
}

declare module "@auth/core/adapters" {
  interface AdapterUser {
    isSuperUser: boolean;
  }
}
