import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import ApexOrb from "../components/ApexOrb";
import ShaderBackground from "../components/ShaderBackground";
import "../components/apex-orb.css";

// APEX supplies the orb and shader. Its README explicitly excludes the humanoid.
// The fullscreen figure is the existing KALTRON canvas, sampled from the user's image.
function useKaltronSignals() {
  const [mode, setMode] = useState("standby");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const wake = () => setOpen(true);
    const dismiss = () => setOpen(false);
    const state = event => setMode(event.detail?.state || "standby");
    window.addEventListener("kaltron:wake", wake);
    window.addEventListener("kaltron:dismiss", dismiss);
    window.addEventListener("kaltron:state", state);
    return () => {
      window.removeEventListener("kaltron:wake", wake);
      window.removeEventListener("kaltron:dismiss", dismiss);
      window.removeEventListener("kaltron:state", state);
    };
  }, []);
  return { mode, open };
}

const orbMode = mode => mode === "speaking" ? "speaking" :
  mode === "listening" ? "listening" :
  mode === "thinking" || mode === "tool" ? "thinking" : "idle";

function ApexBackdrop() {
  const { mode } = useKaltronSignals();
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return <>
    <div className="apex-base" />
    {!reduced && <ShaderBackground opacity={0.24} voiceActive={mode === "speaking"} gold={mode === "speaking"} />}
    <div className="apex-lightcast" />
  </>;
}

function KaltronGenie() {
  const { mode, open } = useKaltronSignals();
  const hostRef = useRef(null);
  const [size, setSize] = useState(320);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const measure = () => setSize(host.clientWidth || 320);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);
  const scale = Math.min(0.7, size / 440);
  return <div className="apex-genie-host" ref={hostRef}>
    <div className="apex-stage" data-apex-stage style={{ transform: `translate(-50%, -50%) scale(${scale})` }} aria-hidden="true">
      <div className="apex-svg-ring"><ApexOrb state={orbMode(mode)} variant="frame" /></div>
      <div className="apex-core-light" data-state={orbMode(mode)} />
    </div>
    {createPortal(
      <AnimatePresence>
        {open && <motion.div
          className="genie-veil"
          initial={{ opacity: 0, clipPath: "circle(1% at 50% 47%)" }}
          animate={{ opacity: 1, clipPath: "circle(150% at 50% 47%)" }}
          exit={{ opacity: 0, clipPath: "circle(1% at 50% 47%)" }}
          transition={{ duration: reduced ? 0.01 : 0.8, ease: [0.2, 0.85, 0.3, 1] }}
        >
          <motion.div className="genie-expanding-orb" initial={{ scale: 1, opacity: 0.85 }}
            animate={{ scale: 15, opacity: 0 }} exit={{ scale: 1, opacity: 0.85 }}
            transition={{ duration: reduced ? 0.01 : 0.95 }} />
          {!reduced && <ShaderBackground opacity={0.34} voiceActive={mode === "speaking"} gold={mode === "speaking"} />}
          <div className="genie-aura" />
          <div className="genie-title" aria-hidden="true">K.A.L.T.R.O.N</div>
        </motion.div>}
      </AnimatePresence>, document.body)}
  </div>;
}

const background = document.getElementById("apexBackground");
const orb = document.getElementById("apexOrbMount");
if (background && orb) {
  createRoot(background).render(<ApexBackdrop />);
  createRoot(orb).render(<KaltronGenie />);
}
