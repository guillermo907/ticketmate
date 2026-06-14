"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Howl } from "howler";

type ConsoleSoundCue = "saved" | "published" | "deleted" | "poster-ready";

const storageKey = "foro_venue_console_sounds_enabled";
const sampleRate = 22050;

type ToneStep = {
  frequency: number;
  durationMs: number;
  gain?: number;
};

function encodeBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return window.btoa(binary);
}

function createToneDataUri(steps: ToneStep[]) {
  const gapSamples = Math.round(sampleRate * 0.012);
  const samples: number[] = [];

  for (const step of steps) {
    const stepSamples = Math.max(1, Math.round((sampleRate * step.durationMs) / 1000));
    const gain = step.gain ?? 0.26;

    for (let sampleIndex = 0; sampleIndex < stepSamples; sampleIndex += 1) {
      const time = sampleIndex / sampleRate;
      const progress = sampleIndex / stepSamples;
      const envelope =
        progress < 0.12
          ? progress / 0.12
          : progress > 0.82
            ? Math.max(0, (1 - progress) / 0.18)
            : 1;
      const sample =
        Math.sin(2 * Math.PI * step.frequency * time) *
        gain *
        envelope;
      samples.push(sample);
    }

    for (let gapIndex = 0; gapIndex < gapSamples; gapIndex += 1) {
      samples.push(0);
    }
  }

  const pcm = new Int16Array(samples.length);

  for (let index = 0; index < samples.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[index] ?? 0));
    pcm[index] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }

  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const dataLength = pcm.length * 2;

  view.setUint32(0, 0x52494646, false);
  view.setUint32(4, 36 + dataLength, true);
  view.setUint32(8, 0x57415645, false);
  view.setUint32(12, 0x666d7420, false);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(36, 0x64617461, false);
  view.setUint32(40, dataLength, true);

  const bytes = new Uint8Array(44 + dataLength);
  bytes.set(new Uint8Array(header), 0);

  for (let index = 0; index < pcm.length; index += 1) {
    const value = pcm[index] ?? 0;
    bytes[44 + index * 2] = value & 0xff;
    bytes[45 + index * 2] = (value >> 8) & 0xff;
  }

  return `data:audio/wav;base64,${encodeBase64(bytes)}`;
}

export function useConsoleSounds() {
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }

    return window.localStorage.getItem(storageKey) !== "false";
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(storageKey, enabled ? "true" : "false");
  }, [enabled]);

  const soundMap = useMemo(() => {
    if (typeof window === "undefined") {
      return null;
    }

    return {
      saved: new Howl({
        src: [createToneDataUri([
          { frequency: 880, durationMs: 56 },
          { frequency: 1174, durationMs: 72, gain: 0.24 },
        ])],
        volume: 0.55,
      }),
      published: new Howl({
        src: [createToneDataUri([
          { frequency: 740, durationMs: 48, gain: 0.22 },
          { frequency: 988, durationMs: 58, gain: 0.24 },
          { frequency: 1318, durationMs: 84, gain: 0.26 },
        ])],
        volume: 0.58,
      }),
      deleted: new Howl({
        src: [createToneDataUri([
          { frequency: 620, durationMs: 62, gain: 0.18 },
          { frequency: 392, durationMs: 88, gain: 0.16 },
        ])],
        volume: 0.42,
      }),
      "poster-ready": new Howl({
        src: [createToneDataUri([
          { frequency: 1046, durationMs: 36, gain: 0.18 },
          { frequency: 1318, durationMs: 54, gain: 0.2 },
        ])],
        volume: 0.4,
      }),
    } satisfies Record<ConsoleSoundCue, Howl>;
  }, []);

  useEffect(() => {
    return () => {
      soundMap?.saved.unload();
      soundMap?.published.unload();
      soundMap?.deleted.unload();
      soundMap?.["poster-ready"].unload();
    };
  }, [soundMap]);

  const playCue = useCallback(
    (cue: ConsoleSoundCue) => {
      if (!enabled) {
        return;
      }

      soundMap?.[cue]?.play();
    },
    [enabled, soundMap],
  );

  return {
    enabled,
    setEnabled,
    playCue,
  };
}
