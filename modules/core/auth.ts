import NextAuth, { type AuthOptions } from "next-auth";
import type { Session } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface User {
    role: Role;
    department: string | null;
    jobTitleName: string | null;
    avatarUrl: string | null;
    isHidden: boolean;
    isTeacher: boolean;
  }
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: Role;
      department: string | null;
      jobTitleName: string | null;
      avatarUrl: string | null;
      isHidden: boolean;
      isTeacher: boolean;
    } | null;
    invalidReason?: "deleted" | "deactivated";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    department: string | null;
    jobTitleName: string | null;
    avatarUrl: string | null;
    isHidden: boolean;
    isTeacher: boolean;
  }
}

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            department: true,
            isActive: true,
            isHidden: true,
            isTeacher: true,
            password: true,
            avatarUrl: true,
            jobTitle: { select: { name: true } },
          },
        });

        if (!user) {
          return null;
        }

        if (!user.isActive) {
          return null;
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          jobTitleName: user.jobTitle?.name ?? null,
          avatarUrl: user.avatarUrl,
          isHidden: user.isHidden,
          isTeacher: user.isTeacher,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.department = user.department;
        token.jobTitleName = user.jobTitleName;
        token.avatarUrl = user.avatarUrl;
        token.isHidden = user.isHidden;
        token.isTeacher = user.isTeacher;
      }

      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { avatarUrl: true, isHidden: true, isActive: true, deletedAt: true, isTeacher: true },
        });

        if (!dbUser || !dbUser.isActive || dbUser.deletedAt) {
          return {
            ...token,
            invalid: true,
            invalidReason: !dbUser || dbUser.deletedAt ? "deleted" : "deactivated",
          };
        }

        token.avatarUrl = dbUser.avatarUrl;
        token.isHidden = dbUser.isHidden;
        token.isTeacher = dbUser.isTeacher;
      }

      return token;
    },
    async session({ session, token }) {
      if ((token as { invalid?: boolean }).invalid) {
        return {
          ...session,
          user: null,
          invalidReason: (token as { invalidReason?: string }).invalidReason,
        } as unknown as Session;
      }

      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.department = token.department;
        session.user.jobTitleName = token.jobTitleName;
        session.user.avatarUrl = token.avatarUrl;
        session.user.isHidden = token.isHidden;
        session.user.isTeacher = token.isTeacher;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
