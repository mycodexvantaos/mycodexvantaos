export interface AuthProvider {
  validateCredentials(email: string, password: string): Promise<boolean>;
  getUserRoles(userId: string): Promise<string[]>;
}

export class NativeAuthProvider implements AuthProvider {
  async validateCredentials(email: string, _password: string): Promise<boolean> {
    return email.length > 0;
  }

  async getUserRoles(_userId: string): Promise<string[]> {
    return ["user"];
  }
}
