import { io, type Socket } from "socket.io-client";
import { SOCKET_PATH } from "@ciklet/embedded-activities-sdk/types";

import { API_BASE_URL } from "@/lib/config";
import { cookieHeaderFor, getSession } from "@/api/client";

/**
 * Tekil Socket.IO bağlantısı. React Native'de kimlik, el sıkışmadaki Cookie
 * başlığıyla taşınır — sunucu tarafı, tarayıcı oturumuyla aynı yoldan doğrular.
 */
let socket: Socket | null = null;

export async function getSocket(): Promise<Socket> {
  if (socket?.connected) return socket;
  if (socket) return socket; // bağlanma sürecinde

  const session = await getSession();
  socket = io(API_BASE_URL, {
    path: SOCKET_PATH,
    transports: ["websocket"],
    extraHeaders: session ? { Cookie: cookieHeaderFor(session) } : undefined,
  });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
