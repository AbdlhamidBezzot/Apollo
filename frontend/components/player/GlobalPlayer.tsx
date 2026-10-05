"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { usePlayer } from "@/lib/playerContext";
import { MiniPlayer } from "@/components/player/MiniPlayer";

/**
 * GlobalPlayer — mounts once in the root layout.
 *
 * Renders:
 *  1. A persistent <video> element in a fixed portal (z-index: -1, invisible)
 *     so it is NEVER unmounted regardless of page navigation.
 *  2. <MiniPlayer> when mode === 'mini'.
 *
 * The MobilePortraitPlayer does NOT render its own <video>. Instead it renders
 * a slot div and in useEffect teleports the <video> node from the portal into
 * that slot using DOM appendChild. On unmount, the video goes back to the portal.
 *
 * This guarantees seamless audio/playback continuity when switching to mini mode.
 */
export function GlobalPlayer() {
  const player = usePlayer();
  const { videoRef, src, contentType, mode } = player;
  const [mounted, setMounted] = useState(false);

  const hlsRef = useRef<Hls | null>(null);
  const prevSrcRef = useRef("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const isEmbed = contentType === "text/html";
  const isHls =
    !isEmbed &&
    (contentType === "application/x-mpegURL" || /\.m3u8(\?|$)/i.test(src));

  /* ── HLS.js lifecycle ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (!src || src === prevSrcRef.current || isEmbed) return;
    prevSrcRef.current = src;

    const video = videoRef.current;
    if (!video) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (isHls && typeof window !== "undefined" && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
    } else if (!isHls) {
      video.src = src;
      video.play().catch(() => {});
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src, isHls, isEmbed, videoRef]);

  /* ── Video event → context sync ─────────────────────────────────────── */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => player.setPlaying(true);
    const onPause = () => player.setPlaying(false);
    const onTime = () => player.setCurrentTime(video.currentTime);
    const onDur = () => player.setDuration(video.duration || 0);
    const onVol = () => { player.setVolume(video.volume); player.setMuted(video.muted); };
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("durationchange", onDur);
    video.addEventListener("volumechange", onVol);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("durationchange", onDur);
      video.removeEventListener("volumechange", onVol);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoRef]);

  if (!mounted) return null;

  return (
    <>
      {/* Persistent video portal — always in DOM, invisible unless teleported */}
      {createPortal(
        <video
          id="apollo-global-video"
          ref={videoRef}
          playsInline
          preload="metadata"
          crossOrigin="anonymous"
          aria-hidden="true"
          /* 
           * Hidden by default. MobilePortraitPlayer will move this node into
           * its player slot via DOM manipulation, making it visible there.
           * When the player returns to mini/hidden, this node comes back here.
           */
          style={{
            position: "fixed",
            width: 1,
            height: 1,
            opacity: 0,
            pointerEvents: "none",
            zIndex: -1,
          }}
        />,
        document.body
      )}

      {/* Mini player */}
      {mode === "mini" && <MiniPlayer />}
    </>
  );
}
