import { NextResponse } from "next/server";

export const runtime = "nodejs";

const UPSTREAM_URL =
  "https://gqhcjqxcvhgwsqfqgekh.supabase.co/functions/v1/get-eligible-agent";
const UPSTREAM_BEARER_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxaGNqcXhjdmhnd3NxZnFnZWtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNjAyNjEsImV4cCI6MjA2NzkzNjI2MX0.s4nuUN7hw_XCltM-XY3jC9o0og3froDRq_i80UCQ-rA";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const upstream = await fetch(UPSTREAM_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UPSTREAM_BEARER_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body ?? {}),
    });

    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Request failed" },
      { status: 500 },
    );
  }
}

