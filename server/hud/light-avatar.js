"use strict";
class KaltronLightAvatar {
  constructor(host) {
    this.host = host;
    this.fullscreen = false;
    this.inputAnalyser = null;
    this.outputAnalyser = null;
    this.onClap = null;
    this.frame = 0;
    this.lastClap = 0;
  }
  setState(state) {
    this.host.classList.toggle("awake", state !== "standby");
    this.host.classList.toggle("speaking", state === "speaking");
  }
  wake() { this.host.classList.add("awake"); }
  dismiss() { this.fullscreen = false; this.host.classList.remove("awake", "speaking"); }
  attachOutputAnalyser(analyser) { this.outputAnalyser = analyser; }
  attachInputAnalyser(analyser, callback) {
    this.inputAnalyser = analyser;
    this.onClap = callback;
    if (!this.frame) this.monitor();
  }
  detachInputAnalyser() {
    this.inputAnalyser = null;
    this.onClap = null;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
  }
  monitor() {
    if (!this.inputAnalyser) { this.frame = 0; return; }
    const data = new Uint8Array(this.inputAnalyser.fftSize);
    this.inputAnalyser.getByteTimeDomainData(data);
    let peak = 0;
    for (const value of data) peak = Math.max(peak, Math.abs(value - 128) / 128);
    const now = performance.now();
    if (peak > 0.65 && now - this.lastClap > 1500) {
      this.lastClap = now;
      if (this.onClap) this.onClap("wake");
    }
    this.frame = requestAnimationFrame(() => this.monitor());
  }
}
window.KaltronAvatar = new KaltronLightAvatar(document.getElementById("reactorWrap"));
