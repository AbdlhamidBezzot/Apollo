"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getResolvedApiUrl } from "@/lib/api";
import type { RoomChatMessage } from "@/lib/types";

interface RemoteState {
  playing?: boolean;
  time?: number;
  rate?: number;
  episode?: number;
  season?: number;
}

interface Options {
  roomCode: string | null;
  sender: string;
  onRemoteState?: (state: RemoteState) => void;
}

export interface MovieNightState {
  connected: boolean;
  members: number;
  host: string;
  code: string | null;
  messages: RoomChatMessage[];
  sendChat: (text: string) => void;
  broadcastState: (state: RemoteState) => void;
}

function wsUrl(code: string): string {
  const baseUrl = getResolvedApiUrl();
  const base = baseUrl.replace(/^http/, "ws");
  return `${base}/api/v1/ws/movie-night/${encodeURIComponent(code)}`;
}

export function useMovieNight({ roomCode, sender, onRemoteState }: Options): MovieNightState {
  const [connected, setConnected] = useState(false);
  const [members, setMembers] = useState(0);
  const [host, setHost] = useState("");
  const [messages, setMessages] = useState<RoomChatMessage[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const senderRef = useRef(sender);
  senderRef.current = sender;
  const onRemoteRef = useRef(onRemoteState);
  onRemoteRef.current = onRemoteState;

  useEffect(() => {
    if (!roomCode) return;
    let closed = false;
    const ws = new WebSocket(wsUrl(roomCode));
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      if (!closed) setConnected(false);
    };
    ws.onerror = () => setConnected(false);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "hello") {
          setMembers(data.members ?? 0);
          setHost(data.host ?? "");
        } else if (data.type === "join" || data.type === "leave") {
          setMembers(data.members ?? 0);
        } else if (data.type === "state") {
          onRemoteRef.current?.(data.payload || {});
        } else if (data.type === "chat") {
          const p = data.payload || {};
          setMessages((m) => [...m.slice(-49), { sender: p.sender || "Guest", text: p.text || "", time: new Date().toLocaleTimeString() }]);
        }
      } catch {
        /* ignore malformed frames */
      }
    };

    return () => {
      closed = true;
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
    };
  }, [roomCode]);

  const sendChat = useCallback((text: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "chat", payload: { sender: senderRef.current, text } }));
    setMessages((m) => [
      ...m.slice(-49),
      { sender: senderRef.current, text, time: new Date().toLocaleTimeString() },
    ]);
  }, []);

  const broadcastState = useCallback((state: RemoteState) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "state", payload: state }));
  }, []);

  return { connected, members, host, code: roomCode, messages, sendChat, broadcastState };
}
