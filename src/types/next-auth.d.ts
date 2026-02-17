import type { UserRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: UserRole;
      isApproved: boolean;
    };
  }

  interface User {
    role?: UserRole;
    isApproved?: boolean;
  }
}
