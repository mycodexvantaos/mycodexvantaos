export interface User {
  id: string;
  email: string;
  role: string;
}

export interface ApiError {
  error: string;
  statusCode: number;
}
