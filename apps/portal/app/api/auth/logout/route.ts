import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(): Promise<NextResponse> {
  const jar = await cookies();
  jar.delete("sgi-session");
  return new NextResponse(null, { status: 204 });
}
