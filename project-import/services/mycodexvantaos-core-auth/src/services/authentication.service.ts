export interface Credentials {
  email: string;
  password: string;
}

export class AuthenticationService {
  async authenticate(credentials: Credentials): Promise<string | null> {
    if (!credentials.email || !credentials.password) return null;
    return credentials.email;
  }
}
