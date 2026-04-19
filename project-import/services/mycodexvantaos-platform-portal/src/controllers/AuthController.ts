import axios from "axios";

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || "http://localhost:3001";

export class AuthController {
  async login(email: string, password: string): Promise<{ token: string; expiresIn: number } | null> {
    try {
      const response = await axios.post(`${AUTH_SERVICE_URL}/api/auth/login`, { email, password });
      return response.data;
    } catch (error) {
      return null;
    }
  }

  async verifyToken(token: string) {
    try {
      const response = await axios.get(`${AUTH_SERVICE_URL}/api/auth/verify`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data.payload;
    } catch (error) {
      return null;
    }
  }

  async register(email: string, password: string, roles?: string[]) {
    try {
      const response = await axios.post(`${AUTH_SERVICE_URL}/api/auth/register`, { email, password, roles });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || "Registration failed");
    }
  }
}
