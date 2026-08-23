export type AuthUser = {
  id: string;
  email: string;
  name?: string | null;
  role?: string;
};

export type AuthTokenPayload = {
  sub: string;
  email: string;
  role?: string;
  iat?: number;
  exp?: number;
};
