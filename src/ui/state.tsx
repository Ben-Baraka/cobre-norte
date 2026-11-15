import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { apply, createLive, type Command } from "../model/simulate";
import type { Live, ScreenId, Target } from "../model/types";

const SCREENS = new Set<ScreenId>([
  "overview", "crush", "stock", "sag", "ball", "rough", "clean", "conc", "tails", "reag", "util",
  "io", "loads", "power", "trends", "alarms",
]);

function readHash(): ScreenId {
  const id = window.location.hash.replace("#", "") as ScreenId;
  return SCREENS.has(id) ? id : "overview";
}

interface PlantApi {
  live: Live;
  screen: ScreenId;
  go: (screen: ScreenId) => void;
  stack: Target[];
  open: (target: Target) => void;
  closeFace: () => void;
  cmd: (command: Command) => void;
}

const Ctx = createContext<PlantApi | null>(null);

export function PlantProvider({ children }: { children: ReactNode }) {
  const [live, setLive] = useState(createLive);
  const [screen, setScreen] = useState<ScreenId>(readHash);
  const [stack, setStack] = useState<Target[]>([]);

  useEffect(() => {
    const id = window.setInterval(() => setLive((prev) => apply(prev, [], 1)), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onHash = () => setScreen(readHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setStack((prev) => prev.slice(0, -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = useCallback((next: ScreenId) => {
    window.location.hash = next;
    setScreen(next);
  }, []);

  const open = useCallback((target: Target) => {
    setStack((prev) => [...prev.slice(-4), target]);
  }, []);

  const closeFace = useCallback(() => setStack((prev) => prev.slice(0, -1)), []);

  const cmd = useCallback((command: Command) => {
    setLive((prev) => apply(prev, [command], 0));
  }, []);

  return <Ctx.Provider value={{ live, screen, go, stack, open, closeFace, cmd }}>{children}</Ctx.Provider>;
}

export function usePlant(): PlantApi {
  const api = useContext(Ctx);
  if (!api) throw new Error("PlantProvider missing");
  return api;
}
