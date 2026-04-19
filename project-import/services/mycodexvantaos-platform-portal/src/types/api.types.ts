export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  message: string;
}

export interface PaginatedResponse<T = unknown> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
