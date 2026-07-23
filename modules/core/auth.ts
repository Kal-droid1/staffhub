import type { Role } from "@prisma/client";

// auth stub — full implementation coming in stage 2
export const auth = {
  // placeholder
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string | null;
};
