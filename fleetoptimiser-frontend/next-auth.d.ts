import NextAuth, {DefaultSession} from "next-auth";
import { JWT } from "next-auth/jwt";

declare module "next-auth/jwt" {
  interface JWT {
    providerAccountId?: string;
    roleValue?: string;
    role_valid?: boolean;
    write_privilege?: boolean;
  }
}

declare module "next-auth" {
  interface Session {
    user: {
      providerAccountId?: string;
      roleValue?: string;
      role_valid?: boolean;
      write_privilege: boolean;
    } & DefaultSession["user"];
  }
}
export {};