export interface IPagination {
  limit: number;
  // Opaque token returned by the previous page; undefined starts from the top
  cursor?: string;
}

export interface IPaginatedResult<T> {
  items: T[];
  // Absent on the last page
  nextCursor?: string;
}
