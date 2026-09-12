"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { Scan } from "lucide-react";
import { replayState, Replay, REPLAY } from "@/lib/replay";
import type { SceneHandle } from "@/components/fly-scene";
import NeuralView from "@/components/neural-view";
const FlyScene = dynamic(() => import("@/components/fly-scene"), {
  ssr: false,
});
const emptyActivity: number[] = [];

export default function Home() {
  const [replay, setReplay] = useState<Replay | null>(null),
    [playing, setPlaying] = useState(true),
    [ready, setReady] = useState(false),
    [time, setTime] = useState(0),
    [loadError, setLoadError] = useState(""),
    [videoMode, setVideoMode] = useState(false);
  const clock = useRef<SceneHandle>({
    time: 0,
    playing: true,
    speed: 1,
    replay: null,
    resetCamera: 0,
  });
  const state = replay ? replayState(replay, time) : null;
  useEffect(() => {
    const abort = new AbortController();
    fetch("/assets/replays.json", { signal: abort.signal })
      .then((r) => {
        if (!r.ok) throw new Error("The recorded runs could not be loaded.");
        return r.json();
      })
      .then((data: Replay[]) => {
        const trained = data.find((r) => r.id === "after");
        if (!trained)
          throw new Error("The trained recording could not be loaded.");
        setReplay(trained);
        clock.current.replay = trained;
        setVideoMode(
          new URLSearchParams(window.location.search).get("video") === "1",
        );
      })
      .catch((e) => {
        if (!abort.signal.aborted) setLoadError(String(e.message));
      });
    const timer = setInterval(
      () => setTime(clock.current.time),
      REPLAY.uiRefreshMs,
    );
    return () => {
      abort.abort();
      clearInterval(timer);
    };
  }, []);
  const onReady = useCallback(() => {
    setReady(true);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      clock.current.playing = false;
      setPlaying(false);
    }
  }, []);
  useEffect(() => {
    if (!videoMode) return;
    const target = window as Window & {
      flyVideo?: {
        ready: boolean;
        frame: (milliseconds: number) => Promise<void>;
      };
    };
    target.flyVideo = {
      ready,
      frame: async (milliseconds) => {
        clock.current.playing = false;
        clock.current.time = milliseconds;
        setPlaying(false);
        setTime(milliseconds);
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
      },
    };
    return () => {
      delete target.flyVideo;
    };
  }, [videoMode, ready]);
  const action = state?.action;
  const activity =
    replay?.activity[String(action?.phase || 0)]?.[state?.neuralStep || 0] ||
    emptyActivity;
  const task = (replay?.task || "Find a green banana").replace(/\.$/, "");
  const items = [
    {
      label: "Search the market",
      detail: `Type “${replay?.fruit || "Banana"}” and search`,
    },
    { label: "Choose the fruit", detail: "Find it in the shuffled results" },
    {
      label: "Pick the ripeness",
      detail: `Select “${replay?.ripeness || "Green"}”`,
    },
  ];
  return (
    <main className={`lab ${videoMode ? "video-mode" : ""}`}>
      <header className="topbar">
        <a href="#" className="wordmark" aria-label="flybrowser home">
          fly<span className="orange">browser</span>
        </a>
        <a
          className="github-link"
          href="https://github.com/derekmeegan/flybrowser"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Flybrowser on GitHub"
          title="GitHub"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M6.766 11.328c-2.063-.25-3.516-1.734-3.516-3.656 0-.781.281-1.625.75-2.188-.203-.515-.172-1.609.063-2.062.625-.078 1.468.25 1.968.703.594-.187 1.219-.281 1.985-.281.765 0 1.39.094 1.953.265.484-.437 1.344-.765 1.969-.687.218.422.25 1.515.046 2.047.5.593.766 1.39.766 2.203 0 1.922-1.453 3.375-3.547 3.64.531.344.89 1.094.89 1.954v1.625c0 .468.391.734.86.547C13.781 14.359 16 11.53 16 8.03 16 3.61 12.406 0 7.984 0 3.563 0 0 3.61 0 8.031a7.88 7.88 0 0 0 5.172 7.422c.422.156.828-.125.828-.547v-1.25c-.219.094-.5.156-.75.156-1.031 0-1.64-.562-2.078-1.609-.172-.422-.36-.672-.719-.719-.187-.015-.25-.093-.25-.187 0-.188.313-.328.625-.328.453 0 .844.281 1.25.86.313.452.64.655 1.031.655s.641-.14 1-.5c.266-.265.47-.5.657-.656" />
          </svg>
        </a>
      </header>
      <section className="workspace">
        <div className="scene-panel">
          <div className="stage">
            {/* This poster is a pre-render of the same data-derived 3D asset. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className={`scene-poster ${ready ? "loaded" : ""}`}
              src="/assets/scene-poster.png"
              alt="A low-poly fly at an orange chair using a computer"
            />
            <FlyScene clock={clock} onReady={onReady} />
            <div className="stage-tools">
              <button
                aria-label="Reset camera"
                onClick={() => {
                  clock.current.resetCamera++;
                }}
              >
                <Scan size={16} />
              </button>
            </div>
            <span className="orbit-hint">
              DRAG TO ORBIT <span>+</span>
            </span>
          </div>
        </div>
      </section>
      {!videoMode && (
        <section className="replay-details" aria-label="Neuron map and task">
          <NeuralView
            values={activity}
            step={state?.neuralStep || 0}
            playing={playing}
          />
          <aside className="task-explanation">
            <h2>{task}</h2>
            <div className="task-overview">
              <p>
                The fly is given a small task: find a banana on the website and
                select one that’s green.
              </p>
              <p>
                We trained a simulated circuit built from part of the fly
                connectome to use a browser with{" "}
                <a
                  href="https://github.com/browserbase/stagehand"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Stagehand
                </a>.
              </p>
            </div>
            {loadError && <p role="alert">{loadError}</p>}
            <ol className="steps">
              {items.map((item, i) => (
                <li key={item.label}>
                  <span>{i + 1}</span>
                  <div>
                    <b>{item.label}</b>
                    <small>{item.detail}</small>
                  </div>
                </li>
              ))}
            </ol>
          </aside>
        </section>
      )}
      {videoMode && state && (
        <>
          <div className="browser-peek">
            <div className="peek-chrome">
              <span>● ● ●</span>
              <b>flymart.local</b>
              <small>Stagehand browser replay</small>
            </div>
            <Image
              src={state.frame}
              alt="Recorded browser task"
              width={1000}
              height={680}
              unoptimized
            />
            <svg viewBox="0 0 1000 680" aria-hidden="true">
              {!state.finished && (
                <path
                  d="M0 0 L2 28 L10 20 L17 32 L23 28 L16 17 L27 15Z"
                  fill="#100d0d"
                  stroke="white"
                  strokeWidth="2"
                  transform={`translate(${state.cursor.x},${state.cursor.y})`}
                />
              )}
            </svg>
          </div>
        </>
      )}
      <footer>
        <a href="/credits.txt">Sources & credits ↗</a>
      </footer>
    </main>
  );
}
