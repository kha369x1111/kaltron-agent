"use strict";

// The supplied reference is sampled only as a shape map; its white background is
// never drawn in the HUD. All visible pixels are animated Canvas particles.
class KaltronParticleAvatar {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: true });
    this.particles = [];
    this.mode = "idle";
    this.fullscreen = false;
    this.state = "standby";
    this.startedAt = 0;
    this.lastActivity = 0;
    this.inputLevel = 0;
    this.outputLevel = 0;
    this.inputAnalyser = null;
    this.outputAnalyser = null;
    this.clapHandler = null;
    this.lastClap = 0;
    this.previousRms = 0;
    this.reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.resize();
    addEventListener("resize", () => this.resize());
    this.loadReference();
    requestAnimationFrame(t => this.frame(t));
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    this.dpr = dpr;
  }

  async loadReference() {
    const img = new Image();
    img.onload = () => {
      const map = document.createElement("canvas");
      map.width = 310; map.height = 310;
      const m = map.getContext("2d", { willReadFrequently: true });
      // Bust + circular energy arc from the supplied 1333×699 image.
      m.drawImage(img, 400, 46, 535, 510, 0, 0, 310, 310);
      const pixels = m.getImageData(0, 0, 310, 310).data;
      const candidates = [];
      for (let y = 0; y < 310; y += 2) {
        for (let x = 0; x < 310; x += 2) {
          const i = (y * 310 + x) * 4;
          const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
          const darkness = 255 - (r * .25 + g * .55 + b * .2);
          if (darkness < 26) continue;
          // More particles along the actual wireframe and neural highlights.
          const saturation = Math.max(r, g, b) - Math.min(r, g, b);
          const weight = Math.min(1, (darkness + saturation * .7) / 105);
          if (Math.random() > weight) continue;
          candidates.push({ x: (x - 155) / 155, y: (y - 155) / 155,
            amber: r > g * 1.12 && r > b * 1.25 });
        }
      }
      this.makeParticles(candidates);
    };
    img.onerror = () => this.makeParticles(this.fallbackShape());
    img.src = "assets/kaltron-reference.jpg";
  }

  fallbackShape() {
    const points = [];
    for (let i = 0; i < 9000; i++) {
      const x = Math.random() * 2 - 1, y = Math.random() * 2 - 1;
      const head = ((x - .12) / .42) ** 2 + ((y + .28) / .55) ** 2 < 1;
      const neck = Math.abs(x + .03) < .13 && y > .15 && y < .55;
      const shoulders = ((x + .02) / .88) ** 2 + ((y - .86) / .38) ** 2 < 1;
      const arc = Math.abs(Math.hypot(x, y) - .9) < .02 && y < .75;
      if (head || neck || shoulders || arc) points.push({ x, y, amber: x > .06 && y < -.22 && y > -.45 });
    }
    return points;
  }

  makeParticles(candidates) {
    if (!candidates.length) candidates = this.fallbackShape();
    const figure = candidates.filter(p => Math.hypot(p.x, p.y * .82) < .77);
    const figurePool = figure.length > 300 ? figure : candidates;
    this.particles = Array.from({ length: 3000 }, (_, i) => {
      const pool = i < 2300 ? figurePool : candidates;
      const point = pool[Math.floor(Math.random() * pool.length)];
      return { x: point.x, y: point.y, amber: point.amber,
        seed: Math.random() * 6.28, delay: Math.random() * .58,
        size: .45 + Math.random() * 1.3, twinkle: .45 + Math.random() * .55 };
    });
  }

  wake() {
    this.lastActivity = performance.now();
    clearTimeout(this.collapseTimer);
    if (!this.fullscreen) {
      this.fullscreen = true;
      this.canvas.parentElement.classList.add("genie-open");
      requestAnimationFrame(() => this.resize());
      window.dispatchEvent(new Event("kaltron:wake"));
    }
    if (this.mode === "idle" || this.mode === "disassembling") {
      this.mode = "assembling";
      this.startedAt = performance.now();
    }
  }

  dismiss() {
    if (!this.fullscreen) return;
    this.state = "standby";
    this.mode = "disassembling";
    this.startedAt = performance.now();
    this.lastActivity = this.startedAt;
    window.dispatchEvent(new Event("kaltron:dismiss"));
    clearTimeout(this.collapseTimer);
    this.collapseTimer = setTimeout(() => {
      this.fullscreen = false;
      this.canvas.parentElement.classList.remove("genie-open");
      this.resize();
    }, this.reducedMotion ? 20 : 850);
  }

  touch() { this.lastActivity = performance.now(); }

  setState(state) {
    this.state = state;
    window.dispatchEvent(new CustomEvent("kaltron:state", { detail: { state } }));
    if (this.fullscreen) this.touch();
  }

  attachInputAnalyser(analyser, onClap) {
    this.inputAnalyser = analyser;
    this.clapHandler = onClap;
    this.inputData = new Float32Array(analyser.fftSize);
  }

  detachInputAnalyser() {
    this.inputAnalyser = null;
    this.inputData = null;
    this.clapHandler = null;
    this.inputLevel = 0;
  }

  attachOutputAnalyser(analyser) {
    this.outputAnalyser = analyser;
    this.outputData = new Float32Array(analyser.fftSize);
  }

  readAudio(t) {
    if (this.inputAnalyser) {
      this.inputAnalyser.getFloatTimeDomainData(this.inputData);
      let sum = 0, peak = 0;
      for (const v of this.inputData) { sum += v * v; peak = Math.max(peak, Math.abs(v)); }
      const rms = Math.sqrt(sum / this.inputData.length);
      this.inputLevel = Math.min(1, rms * 5);
      if (peak > .65 && rms > Math.max(.07, this.previousRms * 2.2) &&
          t - this.lastClap > 1500 && (this.state === "standby" || this.state === "listening")) {
        this.lastClap = t;
        if (this.fullscreen) {
          this.dismiss();
          this.clapHandler?.("dismiss");
        } else {
          this.wake();
          this.clapHandler?.("wake");
        }
      }
      this.previousRms = this.previousRms * .75 + rms * .25;
    }
    if (this.outputAnalyser) {
      this.outputAnalyser.getFloatTimeDomainData(this.outputData);
      let sum = 0;
      for (const v of this.outputData) sum += v * v;
      const next = Math.min(1, Math.sqrt(sum / this.outputData.length) * 7);
      this.outputLevel = Math.max(next, this.outputLevel * .88);
      if (next > .04) this.touch();
    }
  }

  frame(t) {
    // Limit Canvas work on the same CPU that runs multilingual Whisper.
    if (this.lastDraw && t - this.lastDraw < 30) {
      requestAnimationFrame(next => this.frame(next));
      return;
    }
    this.lastDraw = t;
    this.readAudio(t);
    if (this.mode === "assembling" && t - this.startedAt >= 2500)
      this.mode = "active";
    if (this.mode === "active" && this.state === "standby" &&
        t - this.lastActivity > 20000) this.dismiss();
    if (this.mode === "disassembling" && t - this.startedAt > 1150)
      this.mode = "idle";

    this.canvas.parentElement.classList.toggle("awake", this.mode !== "idle");
    this.canvas.parentElement.classList.toggle("speaking", this.state === "speaking");

    // Keep wake/clap/audio analysis running, but spare the CPU-bound Whisper host
    // the old 2D particle draw while the WebGL bust is visible. If WebGL fails,
    // the original particles remain a fallback.
    if (!this.fullscreen || window.Kaltron3DReady) {
      if (this.hasPixels) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.hasPixels = false;
      }
      requestAnimationFrame(next => this.frame(next));
      return;
    }
    this.hasPixels = true;

    const c = this.ctx, w = this.canvas.width, h = this.canvas.height;
    const cx = w / 2, cy = h / 2, scale = Math.min(w, h) * .43;
    c.clearRect(0, 0, w, h);
    const active = this.mode !== "idle";
    const amber = this.state === "speaking" || this.outputLevel > .12;

    // Faint standby ring and source light remain visible throughout assembly.
    c.strokeStyle = amber ? "#ffb30088" : "#00e5ff77";
    c.lineWidth = 1.2 * this.dpr;
    c.shadowColor = amber ? "#ff8c00" : "#00e5ff";
    c.shadowBlur = (active ? 15 : 7) * this.dpr;
    c.beginPath(); c.arc(cx, cy, scale * .97, 0, Math.PI * 2); c.stroke();
    c.shadowBlur = 0;
    const light = c.createRadialGradient(cx, cy + scale * .94, 0, cx, cy + scale * .94, scale * .28);
    light.addColorStop(0, "#ffffffcc");
    light.addColorStop(.18, amber ? "#ffb300aa" : "#00e5ffaa");
    light.addColorStop(1, "#00e5ff00");
    c.fillStyle = light; c.beginPath();
    c.arc(cx, cy + scale * .94, scale * .28, 0, Math.PI * 2); c.fill();

    if (this.particles.length) {
      const elapsed = (t - this.startedAt) / 2500;
      const glow = amber ? .4 + this.outputLevel * 1.7 : .15 + this.inputLevel * .7;
      const sway = this.reducedMotion ? 0 : Math.sin(t / 2300) * .025;
      for (const p of this.particles) {
        let progress = 0;
        if (this.mode === "active") progress = 1;
        else if (this.mode === "assembling") {
          const step = Math.max(0, Math.min(1, (elapsed - p.delay) / (1 - p.delay)));
          progress = this.reducedMotion ? step : step * step * (3 - 2 * step);
        } else if (this.mode === "disassembling")
          progress = 1 - Math.max(0, Math.min(1, (t - this.startedAt) / 1150));
        const sourceX = Math.sin(p.seed * 17 + t / 300) * scale * .035;
        const sourceY = scale * .92 + Math.cos(p.seed * 12 + t / 340) * scale * .025;
        const wave = active ? Math.sin(t / 260 + p.y * 8 + p.seed) * glow * .018 : 0;
        const px = cx + sourceX * (1 - progress) + (p.x + sway + wave) * scale * progress;
        const py = cy + sourceY * (1 - progress) + p.y * scale * progress;
        const alpha = active ? (.5 + p.twinkle * .5) * Math.max(.2, progress) : .08;
        c.fillStyle = p.amber ? `rgba(255,179,0,${alpha})` : `rgba(0,229,255,${alpha})`;
        const size = p.size * this.dpr * (1 + glow * .35) * (this.fullscreen ? 1.8 : 1);
        c.fillRect(px, py, size, size);
      }
      if (active) {
        const coreX = cx + scale * .15, coreY = cy - scale * .38;
        const core = c.createRadialGradient(coreX, coreY, 0, coreX, coreY, scale * .24);
        core.addColorStop(0, `rgba(255,179,0,${.25 + this.outputLevel * .55})`);
        core.addColorStop(1, "rgba(255,140,0,0)");
        c.fillStyle = core; c.beginPath(); c.arc(coreX, coreY, scale * .24, 0, Math.PI * 2); c.fill();
      }
    }
    requestAnimationFrame(next => this.frame(next));
  }
}

window.KaltronAvatar = new KaltronParticleAvatar(document.getElementById("kaltron-avatar"));
