/**
 * Utility to emit Socket.IO events from Next.js API routes
 * by making HTTP requests to the Socket.IO server
 */

const SOCKET_SERVER_URL =
  process.env.SOCKET_SERVER_URL || "http://localhost:3001";

export async function emitSocketEvent(
  room: string,
  event: string,
  data: unknown,
): Promise<boolean> {
  try {
    const response = await fetch(`${SOCKET_SERVER_URL}/emit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ room, event, data }),
    });

    if (!response.ok) {
      console.error(`Failed to emit socket event: ${response.statusText}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error emitting socket event:", error);
    return false;
  }
}
