import { NextResponse } from "next/server";

/** Thrown by route helpers; carries the HTTP status to return. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : "Internal error";
  return NextResponse.json({ error: message }, { status: 500 });
}
