import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      activeProfile: string;
      emailVerified?: string | null;
    };
  }

  interface User {
    id: string;
    activeProfile?: string;
    emailVerified?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    activeProfile?: string;
    emailVerified?: string | null;
  }
}
