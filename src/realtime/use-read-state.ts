import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useIsFocused } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { applyReadState } from "@/features/unread/unread-cache";

/**
 * Okundu bilgisi.
 *
 * Sohbet açıkken görülen en yeni mesaj `/api/read-state/ack` ile bildirilir
 * (ADR-0012 öncesi Socket.IO `MESSAGE_ACK` olayıydı). Sunucu imleci
 * ilerletip `read_state.updated` yayınlar; o olayı kök düzeyde
 * `use-unread-sync` dinler (sohbetten çıkınca gelen yayın da kaçmasın).
 *
 * Aynı mesaj için tekrar ack gönderilmez — kullanıcı listede kaydırdıkça
 * istek yağmuru olmaz.
 */
export function useReadState(
  chatId: string | undefined,
  kind: "channel" | "direct",
  /** Listedeki en yeni mesajın kimliği (outbox kayıtları hariç). */
  latestMessageId: string | undefined
) {
  const queryClient = useQueryClient();
  const lastAcked = useRef<string | null>(null);
  // Arka plandayken gelen mesaj okunmuş sayılmaz (web: `document.hidden`);
  // öne dönünce bekleyen ack gönderilir.
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  // Üstüne başka ekran itilmişse de görülmüyor (bkz. chat-view `useActiveChat`).
  const focused = useIsFocused();

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => setAppActive(next === "active"));
    return () => subscription.remove();
  }, []);

  // Sohbet değişince imleci sıfırla — ack efektinden ÖNCE çalışmalı.
  useEffect(() => {
    lastAcked.current = null;
  }, [chatId]);

  // Okundu bildir.
  useEffect(() => {
    if (!chatId || !latestMessageId || !appActive || !focused) return;
    if (lastAcked.current === latestMessageId) return;
    lastAcked.current = latestMessageId;

    const target = kind === "channel" ? { channelId: chatId } : { directId: chatId };
    void api(endpoints.readStateAck, {
      method: "POST",
      body: { ...target, messageId: latestMessageId },
    })
      .then(() => {
        // Rozet geri dönüldüğünde zaten silinmiş olsun; yayını bekleme
        // (`read_state.updated` de aynı işi yapar, iki kez uygulamak zararsız).
        applyReadState(queryClient, { ...target, messageId: latestMessageId });
      })
      .catch(() => {
        // Başarısız ack bir sonraki mesajda tekrar denenir.
        if (lastAcked.current === latestMessageId) lastAcked.current = null;
      });
  }, [chatId, kind, latestMessageId, appActive, focused, queryClient]);
}
