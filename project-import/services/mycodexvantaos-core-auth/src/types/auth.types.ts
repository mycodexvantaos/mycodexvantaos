export interface User {
  id: string;
  email: string;
  roles: string[];
}

export interface TokenPayload {
  sub: string;
  email: string;
  roles: string[];
}

export interface LoginResult {
  token: string;
  expiresIn: number;
}

export interface Permission {
  resource: string;
  action: string;
}
