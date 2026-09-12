"use client";
import { useEffect, useRef, useState } from "react";
type Neurons = { positions: number[][]; bodyIds: number[] };
export default function NeuralView({
  values,
  step,
  playing,
}: {
  values: number[];
  step: number;
  playing: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    current = useRef(values),
    running = useRef(playing);
  const [count, setCount] = useState(0),
    [error, setError] = useState("");
  useEffect(() => {
    current.current = values;
  }, [values]);
  useEffect(() => {
    running.current = playing;
  }, [playing]);
  useEffect(() => {
    const element = canvas.current!;
    const ctx = element.getContext("2d");
    if (!ctx) return;
    const abort = new AbortController();
    let gone = false,
      id = 0,
      neurons: Neurons | null = null;
    let radius = 1,
      yMin = -1,
      yMax = 1;
    let width = 1,
      height = 1,
      pixelRatio = 1;
    fetch("/assets/neurons.json", { signal: abort.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Neuron positions unavailable");
        return r.json();
      })
      .then((data: Neurons) => {
        if (gone) return;
        neurons = data;
        // Fit all measured positions without stretching their anatomy.
        radius = Math.max(
          0.01,
          ...data.positions.map((p) => Math.hypot(p[0], p[2])),
        );
        yMin = Math.min(...data.positions.map((p) => p[1]));
        yMax = Math.max(...data.positions.map((p) => p[1]));
        setCount(data.positions.length);
      })
      .catch((e) => {
        if (!gone) setError(e.message);
      });
    const resize = new ResizeObserver(() => {
      const bounds = element.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      width = bounds.width;
      height = bounds.height;
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      element.width = Math.round(width * pixelRatio);
      element.height = Math.round(height * pixelRatio);
    });
    resize.observe(element);
    let angle = 0,
      last = performance.now();
    const draw = (now: number) => {
      if (running.current && !document.hidden)
        angle += Math.min(now - last, 100) * 0.000065;
      last = now;
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      if (neurons) {
        const cs = Math.cos(angle),
          sn = Math.sin(angle);
        const scale = Math.max(
          0,
          Math.min(
            (width - 32) / (2 * radius),
            (height - 28) / Math.max(0.01, yMax - yMin),
          ),
        );
        const centerY = (yMin + yMax) / 2;
        const drawPoint = (p: number[], pointRadius: number) => {
          const x = width / 2 + (p[0] * cs + p[2] * sn) * scale;
          const y = height / 2 + (p[1] - centerY) * scale;
          ctx.beginPath();
          ctx.arc(x, y, pointRadius, 0, Math.PI * 2);
          ctx.fill();
        };
        // Keep the anatomy visible, then draw recorded activity above it.
        ctx.fillStyle = "#8c827c";
        neurons.positions.forEach((p) => drawPoint(p, 1.5));
        ctx.fillStyle = "#f03603";
        neurons.positions.forEach((p, i) => {
          const value = Math.min(1, Math.abs(current.current[i] || 0) / 0.34);
          if (value === 0) return;
          ctx.globalAlpha = value;
          drawPoint(p, 1.5 + value * 1.35);
        });
        ctx.globalAlpha = 1;
      }
      id = requestAnimationFrame(draw);
    };
    id = requestAnimationFrame(draw);
    return () => {
      gone = true;
      abort.abort();
      resize.disconnect();
      cancelAnimationFrame(id);
    };
  }, []);
  return (
    <div className="neural-view">
      <div className="neural-title">
        <span>NEURON MAP</span>
        <span
          title="Simulation update within each browser decision"
          aria-label={`${step} of 6 model updates within the current browser decision`}
        >
          {step}/6
        </span>
      </div>
      <canvas
        ref={canvas}
        role="img"
        aria-label={`${count} measured neuron positions colored by recorded modeled activity`}
      />
      <div className="neural-caption">
        <span>
          {count
            ? `${count.toLocaleString()} measured positions`
            : "Loading neuron positions"}
        </span>
      </div>
      {error && (
        <p className="neural-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
