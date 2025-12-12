import { Fragment, jsxDEV } from "react/jsx-dev-runtime";
import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import * as THREE from "three";
const ThreeJsRecorder = ({ data, onComplete, onError }) => {
  const canvasRef = useRef(null);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (!data || !canvasRef.current) return;
    console.log("Initializing Recorder for data:", data);
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(5592405, 2e-3);
    scene.background = new THREE.Color(328965);
    const width = 1280;
    const height = 720;
    const fps = 30;
    const camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 1e3);
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      preserveDrawingBuffer: true
      // CRITICAL for captureStream
    });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    const ambientLight = new THREE.AmbientLight(4210752, 2);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(16777215, 2);
    dirLight.position.set(100, 500, 100);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 200;
    dirLight.shadow.camera.bottom = -200;
    dirLight.shadow.camera.left = -200;
    dirLight.shadow.camera.right = 200;
    scene.add(dirLight);
    const towerGeo = new THREE.BoxGeometry(40, 300, 40);
    const towerMat = new THREE.MeshStandardMaterial({ color: 6710886, roughness: 0.8 });
    const tower = new THREE.Mesh(towerGeo, towerMat);
    tower.position.set(0, 150, 0);
    tower.castShadow = true;
    tower.receiveShadow = true;
    scene.add(tower);
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(42, 1, 42),
      new THREE.MeshStandardMaterial({ color: 3355443, roughness: 0.6 })
    );
    roof.position.set(0, 300.5, 0);
    roof.castShadow = true;
    scene.add(roof);
    const rnd = /* @__PURE__ */ (() => {
      let seed = 5678;
      return () => {
        seed = (Math.floor(seed) * 9301 + 49297) % 233280;
        return seed / 233280;
      };
    })();
    for (let i = 0; i < 20; i++) {
      const h = 50 + rnd() * 200;
      const w = 20 + rnd() * 30;
      const x = (rnd() - 0.5) * 500;
      const z = (rnd() - 0.5) * 500;
      if (Math.abs(x) < 50 && Math.abs(z) < 50) continue;
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, w),
        new THREE.MeshStandardMaterial({ color: 2236962 })
      );
      b.position.set(x, h / 2, z);
      b.castShadow = true;
      b.receiveShadow = true;
      scene.add(b);
    }
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1e3, 1e3),
      new THREE.MeshStandardMaterial({ color: 1052688 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    const ghostMat = new THREE.MeshBasicMaterial({ color: 65280, wireframe: true });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), ghostMat);
    const lHand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.15), ghostMat);
    const rHand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.15), ghostMat);
    scene.add(head, lHand, rHand);
    renderer.render(scene, camera);
    const chunks = [];
    let recorder = null;
    let isRecording = false;
    try {
      const stream = canvasRef.current.captureStream(fps);
      const mimeTypes = ["video/webm;codecs=vp9", "video/webm", "video/mp4"];
      const selectedType = mimeTypes.find((type) => MediaRecorder.isTypeSupported(type)) || "";
      console.log("Using MIME type:", selectedType);
      const options = selectedType ? { mimeType: selectedType, videoBitsPerSecond: 5e6 } : {};
      recorder = new MediaRecorder(stream, options);
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: selectedType || "video/webm" });
        console.log(`Recorder stopped. Blob size: ${blob.size} bytes`);
        if (blob.size < 1e3) {
          onError("Video empty (Blob < 1KB)");
        } else {
          const url = URL.createObjectURL(blob);
          onComplete(url);
        }
      };
    } catch (e) {
      console.error("Setup error:", e);
      onError(e.message);
      return;
    }
    let startTime = null;
    let frameId = null;
    const totalDuration = data.duration + 500;
    const animate = (timestamp) => {
      if (!startTime) {
        startTime = timestamp;
        if (recorder && recorder.state === "inactive") {
          recorder.start();
          isRecording = true;
          console.log("Recorder started.");
        }
      }
      const elapsed = timestamp - startTime;
      const progress2 = Math.min(1, elapsed / totalDuration);
      setProgress(progress2);
      window.dispatchEvent(new CustomEvent("render-progress", { detail: { progress: progress2 } }));
      if (elapsed >= totalDuration) {
        if (recorder && recorder.state === "recording") {
          recorder.stop();
          console.log("Stopping recorder.");
        }
        return;
      }
      if (data.frames && data.frames.length > 0) {
        const targetTime = elapsed;
        let closestFrame = data.frames[0];
        let minDiff = Math.abs(closestFrame.t - targetTime);
        for (let i = 0; i < data.frames.length; i++) {
          const diff = Math.abs(data.frames[i].t - targetTime);
          if (diff < minDiff) {
            minDiff = diff;
            closestFrame = data.frames[i];
          }
        }
        const [hPos, hRot] = closestFrame.h;
        const [lPos, lRot] = closestFrame.l;
        const [rPos, rRot] = closestFrame.r;
        head.position.fromArray(hPos);
        head.quaternion.fromArray(hRot);
        lHand.position.fromArray(lPos);
        lHand.quaternion.fromArray(lRot);
        rHand.position.fromArray(rPos);
        rHand.quaternion.fromArray(rRot);
        const tPos = new THREE.Vector3().fromArray(hPos);
        const tRot = new THREE.Quaternion().fromArray(hRot);
        const offset = new THREE.Vector3(0, 0.5, 2).applyQuaternion(tRot);
        camera.position.copy(tPos).add(offset);
        camera.lookAt(tPos);
      }
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    setTimeout(() => {
      frameId = requestAnimationFrame(animate);
    }, 100);
    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      if (recorder && recorder.state === "recording") recorder.stop();
      renderer.dispose();
      scene.clear();
    };
  }, [data]);
  return /* @__PURE__ */ jsxDEV("div", { style: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    background: "black",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column"
  }, children: [
    /* @__PURE__ */ jsxDEV("h2", { style: { color: "white", fontFamily: "sans-serif" }, children: [
      "RENDERING REPLAY: ",
      Math.round(progress * 100),
      "%"
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 234,
      columnNumber: 13
    }),
    /* @__PURE__ */ jsxDEV(
      "canvas",
      {
        ref: canvasRef,
        width: 1280,
        height: 720,
        style: {
          width: "640px",
          height: "360px",
          border: "1px solid #333",
          marginTop: "20px"
        }
      },
      void 0,
      false,
      {
        fileName: "<stdin>",
        lineNumber: 235,
        columnNumber: 13
      }
    )
  ] }, void 0, true, {
    fileName: "<stdin>",
    lineNumber: 230,
    columnNumber: 9
  });
};
const RemotionOverlay = () => {
  const [replayData, setReplayData] = useState(null);
  const [recordedUrl, setRecordedUrl] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    const handleReplay = (e) => {
      console.log("Overlay received render-replay", e.detail);
      setReplayData(e.detail);
      setRecordedUrl(null);
      setError(null);
    };
    const handleClose = () => {
      setReplayData(null);
      setRecordedUrl(null);
      setError(null);
    };
    window.addEventListener("render-replay", handleReplay);
    window.addEventListener("close-replay", handleClose);
    return () => {
      window.removeEventListener("render-replay", handleReplay);
      window.removeEventListener("close-replay", handleClose);
    };
  }, []);
  const handleComplete = (url) => {
    setRecordedUrl(url);
    window.dispatchEvent(new CustomEvent("render-complete", { detail: { success: true, url } }));
  };
  const handleError = (msg) => {
    setError(msg);
    window.dispatchEvent(new CustomEvent("render-complete", { detail: { success: false, error: msg } }));
  };
  const downloadVideo = () => {
    if (recordedUrl) {
      const a = document.createElement("a");
      a.href = recordedUrl;
      a.download = `skydrop-replay-${(/* @__PURE__ */ new Date()).toISOString().replace(/:/g, "-")}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };
  if (!replayData) return null;
  return /* @__PURE__ */ jsxDEV("div", { style: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    zIndex: 9999,
    pointerEvents: "auto",
    background: "rgba(0,0,0,0.9)"
  }, children: [
    !recordedUrl && !error && /* @__PURE__ */ jsxDEV(
      ThreeJsRecorder,
      {
        data: replayData,
        onComplete: handleComplete,
        onError: handleError
      },
      void 0,
      false,
      {
        fileName: "<stdin>",
        lineNumber: 305,
        columnNumber: 17
      }
    ),
    (recordedUrl || error) && /* @__PURE__ */ jsxDEV("div", { style: {
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column"
    }, children: /* @__PURE__ */ jsxDEV("div", { style: {
      background: "#222",
      padding: "40px",
      borderRadius: "20px",
      textAlign: "center",
      border: "2px solid #555",
      maxWidth: "500px"
    }, children: [
      error ? /* @__PURE__ */ jsxDEV(Fragment, { children: [
        /* @__PURE__ */ jsxDEV("h2", { style: { color: "#ff4444", marginBottom: "20px" }, children: "RENDER FAILED" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 324,
          columnNumber: 33
        }),
        /* @__PURE__ */ jsxDEV("p", { style: { color: "#aaa", marginBottom: "30px" }, children: error }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 325,
          columnNumber: 33
        })
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 323,
        columnNumber: 29
      }) : /* @__PURE__ */ jsxDEV(Fragment, { children: [
        /* @__PURE__ */ jsxDEV("h2", { style: { color: "white", marginBottom: "30px" }, children: "REPLAY READY" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 329,
          columnNumber: 33
        }),
        /* @__PURE__ */ jsxDEV(
          "video",
          {
            src: recordedUrl,
            controls: true,
            autoPlay: true,
            loop: true,
            style: { width: "100%", marginBottom: "20px", borderRadius: "8px", border: "1px solid #444" }
          },
          void 0,
          false,
          {
            fileName: "<stdin>",
            lineNumber: 330,
            columnNumber: 33
          }
        ),
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: downloadVideo,
            style: {
              padding: "15px 30px",
              fontSize: "20px",
              fontWeight: "bold",
              color: "white",
              background: "#00cc00",
              border: "none",
              borderRadius: "10px",
              cursor: "pointer",
              marginBottom: "15px",
              width: "100%"
            },
            children: "SAVE TO DEVICE"
          },
          void 0,
          false,
          {
            fileName: "<stdin>",
            lineNumber: 337,
            columnNumber: 33
          }
        )
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 328,
        columnNumber: 29
      }),
      /* @__PURE__ */ jsxDEV(
        "button",
        {
          onClick: () => window.dispatchEvent(new CustomEvent("close-replay")),
          style: {
            padding: "15px 30px",
            fontSize: "16px",
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
          lineNumber: 349,
          columnNumber: 25
        }
      )
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 318,
      columnNumber: 21
    }) }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 313,
      columnNumber: 18
    })
  ] }, void 0, true, {
    fileName: "<stdin>",
    lineNumber: 300,
    columnNumber: 9
  });
};
const root = document.getElementById("remotion-root");
if (root) {
  createRoot(root).render(/* @__PURE__ */ jsxDEV(RemotionOverlay, {}, void 0, false, {
    fileName: "<stdin>",
    lineNumber: 368,
    columnNumber: 29
  }));
}
