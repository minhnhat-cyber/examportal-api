import corsHeaders from "@/lib/cors";
import { currentUser, serializeUser } from "@/lib/auth";
export function OPTIONS() { return new Response(null, { status: 204, headers: corsHeaders }); }
export async function GET(request) {
  try {
    const user = await currentUser(request);
    return Response.json(user ? serializeUser(user) : { message: "Please sign in." }, { status: user ? 200 : 401, headers: { ...corsHeaders, "Cache-Control": "no-store" } });
  } catch { return Response.json({ message: "Unable to load your account." }, { status: 503, headers: corsHeaders }); }
}
