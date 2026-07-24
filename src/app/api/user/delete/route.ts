import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import { deleteSession } from "@/lib/auth-d1";

/**
 * DELETE /api/user/delete
 * Delete the current user's account and all associated data.
 * Requires authentication via session cookie.
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAuth(request);
  
  if (auth instanceof NextResponse) {
    return auth; // 401 or 503 response
  }

  const { userId, email } = auth;

  // Get the session token to delete it
  const sessionId = request.cookies.get("session_token")?.value;

  try {
    // Get the D1 database binding
    const env = process.env as unknown as { AUTH_DB?: any };
    const db = env.AUTH_DB;
    
    if (!db) {
      return NextResponse.json({ error: "Auth not configured" }, { status: 503 });
    }

    // Delete the session first
    if (sessionId) {
      await deleteSession(db, sessionId);
    }

    // Delete user data (cascades to user_role, session, session_log via foreign keys)
    // Note: This assumes foreign key constraints with ON DELETE CASCADE are set up
    const result = await db
      .prepare("DELETE FROM user WHERE id = ?")
      .bind(userId)
      .run();

    if (result.meta?.changes === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Clear the session cookie
    const response = NextResponse.json({ 
      success: true, 
      message: "Account deleted successfully" 
    });
    response.cookies.delete("session_token");
    
    return response;
  } catch (error) {
    console.error("[user/delete] Error deleting user:", error);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}