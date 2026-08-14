import NextAuth, { type AuthOptions } from "next-auth";
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
    };
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
      }

      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { avatarUrl: true, isHidden: true },
        });
        token.avatarUrl = dbUser?.avatarUrl ?? null;
        token.isHidden = dbUser?.isHidden ?? false;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.department = token.department;
        session.user.jobTitleName = token.jobTitleName;
        session.user.avatarUrl = token.avatarUrl;
        session.user.isHidden = token.isHidden;
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
