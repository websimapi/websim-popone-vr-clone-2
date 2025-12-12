import { jsxDEV } from "react/jsx-dev-runtime";
import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Player } from "@websim/remotion/player";
import { ReplayComposition } from "./composition.jsx";
const RemotionOverlay = () => {
  const [replayData, setReplayData] = useState(null);
  const [recordedUrl, setRecordedUrl] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const containerRef = useRef(null);
  useEffect(() => {
    const handleReplay = (e) => {
      console.log("Received replay data", e.detail);
      setReplayData(e.detail);
      setRecordedUrl(null);
      chunksRef.current = [];
    };
    const handleClose = () => {
      setReplayData(null);
      setRecordedUrl(null);
      setIsRecording(false);
    };
    window.addEventListener("render-replay", handleReplay);
    window.addEventListener("close-replay", handleClose);
    return () => {
      window.removeEventListener("render-replay", handleReplay);
      window.removeEventListener("close-replay", handleClose);
    };
  }, []);
  useEffect(() => {
    if (!replayData || !containerRef.current || isRecording || recordedUrl) return;
    const checkCanvas = setInterval(() => {
      const canvas = containerRef.current?.querySelector("canvas");
      if (canvas && canvas.width > 0) {
        clearInterval(checkCanvas);
        setTimeout(() => startRecording(canvas), 1e3);
      }
    }, 500);
    return () => clearInterval(checkCanvas);
  }, [replayData]);
  const startRecording = (canvas) => {
    if (isRecording) return;
    console.log("Starting Recording...", canvas);
    setIsRecording(true);
    chunksRef.current = [];
    try {
      const stream = canvas.captureStream(60);
      const mimeTypes = [
        "video/webm;codecs=vp9",
        "video/webm",
        "video/mp4"
      ];
      let selectedType = mimeTypes.find((type) => MediaRecorder.isTypeSupported(type)) || "";
      const options = selectedType ? {
        mimeType: selectedType,
        videoBitsPerSecond: 25e5
        // 2.5 Mbps as per example
      } : { videoBitsPerSecond: 25e5 };
      console.log("MediaRecorder Options:", options);
      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: selectedType || "video/webm" });
        console.log(`Recording finished. Blob size: ${blob.size}`);
        if (blob.size < 1e3) {
          console.error("Blob too small, recording likely failed.");
          window.dispatchEvent(new CustomEvent("render-complete", {
            detail: { success: false, error: "Video empty (Blob < 1KB)" }
          }));
        } else {
          const url = URL.createObjectURL(blob);
          setRecordedUrl(url);
          window.dispatchEvent(new CustomEvent("render-complete", {
            detail: { url, success: true }
          }));
        }
        setIsRecording(false);
      };
      recorder.start();
      const duration = (replayData.duration || 5e3) + 1e3;
      const startTime = Date.now();
      const progInterval = setInterval(() => {
        const p = Math.min(1, (Date.now() - startTime) / duration);
        setProgress(p);
        window.dispatchEvent(new CustomEvent("render-progress", { detail: { progress: p } }));
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
          clearInterval(progInterval);
        }
      }, 100);
      setTimeout(() => {
        if (recorder.state === "recording") {
          recorder.stop();
        }
        clearInterval(progInterval);
      }, duration);
    } catch (e) {
      console.error("Start Recording Failed:", e);
      setIsRecording(false);
      window.dispatchEvent(new CustomEvent("render-complete", {
        detail: { success: false, error: e.message }
      }));
    }
  };
  const downloadVideo = () => {
    if (recordedUrl) {
      const a = document.createElement("a");
      a.href = recordedUrl;
      a.download = `skydrop-replay-${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };
  if (!replayData) return null;
  const fps = 30;
  const durationInFrames = Math.max(1, Math.ceil(replayData.duration / 1e3 * fps));
  return /* @__PURE__ */ jsxDEV("div", { ref: containerRef, style: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999
  }, children: [
    isRecording && /* @__PURE__ */ jsxDEV("div", { style: {
      position: "absolute",
      top: "20px",
      left: "50%",
      transform: "translateX(-50%)",
      background: "rgba(0,0,0,0.8)",
      padding: "10px 20px",
      borderRadius: "8px",
      color: "#fff",
      zIndex: 10002,
      fontSize: "20px",
      fontWeight: "bold"
    }, children: [
      "RENDERING REPLAY: ",
      Math.round(progress * 100),
      "%"
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 174,
      columnNumber: 17
    }),
    /* @__PURE__ */ jsxDEV("div", { style: {
      width: "640px",
      height: "360px",
      border: "2px solid #333",
      background: "#000",
      position: "relative",
      boxShadow: "0 0 50px rgba(0,0,0,0.8)",
      zIndex: 1e4
    }, children: /* @__PURE__ */ jsxDEV(
      Player,
      {
        component: ReplayComposition,
        durationInFrames,
        fps,
        compositionWidth: 1280,
        compositionHeight: 720,
        inputProps: { data: replayData },
        controls: false,
        autoplay: true,
        loop: true,
        style: { width: "100%", height: "100%" }
      },
      void 0,
      false,
      {
        fileName: "<stdin>",
        lineNumber: 201,
        columnNumber: 17
      }
    ) }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 192,
      columnNumber: 13
    }),
    recordedUrl && !isRecording && /* @__PURE__ */ jsxDEV("div", { style: {
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      background: "rgba(0,0,0,0.7)",
      zIndex: 10003,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      pointerEvents: "auto"
    }, children: /* @__PURE__ */ jsxDEV("div", { style: {
      background: "#222",
      padding: "40px",
      borderRadius: "20px",
      textAlign: "center",
      border: "2px solid #555"
    }, children: [
      /* @__PURE__ */ jsxDEV("h2", { style: { color: "white", marginBottom: "30px" }, children: "REPLAY READY" }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 234,
        columnNumber: 25
      }),
      /* @__PURE__ */ jsxDEV(
        "button",
        {
          onClick: downloadVideo,
          style: {
            padding: "20px 40px",
            fontSize: "24px",
            fontWeight: "bold",
            color: "white",
            background: "#00cc00",
            border: "none",
            borderRadius: "10px",
            cursor: "pointer",
            marginBottom: "20px",
            width: "100%"
          },
          children: "SAVE TO DEVICE"
        },
        void 0,
        false,
        {
          fileName: "<stdin>",
          lineNumber: 235,
          columnNumber: 25
        }
      ),
      /* @__PURE__ */ jsxDEV("br", {}, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 252,
        columnNumber: 25
      }),
      /* @__PURE__ */ jsxDEV(
        "button",
        {
          onClick: () => window.dispatchEvent(new CustomEvent("close-replay")),
          style: {
            padding: "15px 30px",
            fontSize: "18px",
            color: "#aaa",
            background: "transparent",
            border: "2px solid #555",
            borderRadius: "10px",
            cursor: "pointer",
            width: "100%"
          },
          children: "CLOSE"
        },
        void 0,
        false,
        {
          fileName: "<stdin>",
          lineNumber: 253,
          columnNumber: 25
        }
      )
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 227,
      columnNumber: 21
    }) }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 217,
      columnNumber: 17
    })
  ] }, void 0, true, {
    fileName: "<stdin>",
    lineNumber: 160,
    columnNumber: 9
  });
};
const root = document.getElementById("remotion-root");
if (root) {
  createRoot(root).render(/* @__PURE__ */ jsxDEV(RemotionOverlay, {}, void 0, false, {
    fileName: "<stdin>",
    lineNumber: 277,
    columnNumber: 29
  }));
}
