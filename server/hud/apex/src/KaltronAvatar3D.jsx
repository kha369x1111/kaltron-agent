import React, { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const POINT_COUNT = 2500;
const CYAN = new THREE.Color("#00e5ff");
const BLUE = new THREE.Color("#147dff");

const pointVertex = /* glsl */`
  attribute float aSeed;
  attribute float aRegion;
  uniform float uTime;
  uniform float uState;
  uniform float uAudio;
  uniform float uBoot;
  uniform float uPixelRatio;
  varying float vSeed;
  varying float vGlow;
  varying float vRegion;
  float hash(float n) { return fract(sin(n) * 43758.5453123); }
  void main() {
    vSeed = aSeed; vRegion = aRegion;
    float boot = smoothstep(0.0, 1.0, uBoot);
    vec3 scattered = position * (1.7 + hash(aSeed * 19.1) * 2.4);
    scattered.y -= 1.2 + hash(aSeed * 7.7) * 1.9;
    vec3 p = mix(scattered, position, boot);
    float listen = step(1.5, uState) * (1.0 - step(2.5, uState));
    float think = step(2.5, uState) * (1.0 - step(3.5, uState));
    float speak = step(3.5, uState);
    float amplitude = 0.008 + listen * 0.018 + think * 0.032 + speak * (0.018 + uAudio * 0.045);
    float speed = 0.55 + listen * 0.65 + think * 1.8 + speak * 1.2;
    p += vec3(sin(uTime * speed + aSeed * 31.0), cos(uTime * speed * .83 + aSeed * 19.0), sin(uTime * speed * .61 + aSeed * 47.0)) * amplitude;
    if (think > 0.5) p.x += sin(p.y * 12.0 + uTime * 2.4) * 0.008;
    if (speak > 0.5 && aRegion > 1.5) p.y -= uAudio * 0.024;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float sparkle = step(0.93, hash(aSeed * 113.0 + floor(uTime * 2.0)));
    vGlow = sparkle + listen * .18 + think * .22 + speak * (.25 + uAudio * .8);
    gl_PointSize = (2.25 + sparkle * 2.3 + speak * uAudio * 1.8) * uPixelRatio * (3.1 / max(1.0, -mv.z));
  }
`;

const pointFragment = /* glsl */`
  precision highp float;
  uniform vec3 uCyan;
  uniform vec3 uBlue;
  uniform float uState;
  uniform float uAudio;
  varying float vSeed;
  varying float vGlow;
  varying float vRegion;
  float hash(float n) { return fract(sin(n) * 43758.5453123); }
  void main() {
    vec2 q = gl_PointCoord - .5;
    float d = length(q);
    if (d > .5) discard;
    float soft = smoothstep(.5, .04, d);
    float whitePoint = step(.955, hash(vSeed * 71.7));
    vec3 color = mix(uBlue, uCyan, .38 + .34 * sin(vSeed * 51.0));
    color = mix(color, vec3(1.0), whitePoint * .92 + vGlow * .3);
    if (uState > 3.5 && vRegion > 1.5) color = mix(color, vec3(1.0), uAudio * .5);
    gl_FragColor = vec4(color, soft * (.62 + whitePoint * .38 + vGlow * .22));
  }
`;

const lineVertex = /* glsl */`
  attribute float aSeed;
  uniform float uTime;
  uniform float uState;
  uniform float uAudio;
  uniform float uBoot;
  varying float vPulse;
  float hash(float n) { return fract(sin(n) * 43758.5453123); }
  void main() {
    float boot = smoothstep(.05, 1.0, uBoot);
    vec3 scattered = position * (1.7 + hash(aSeed * 19.1) * 2.4);
    scattered.y -= 1.2 + hash(aSeed * 7.7) * 1.9;
    vec3 p = mix(scattered, position, boot);
    float active = step(1.5, uState);
    float amp = .004 + active * .008 + step(3.5, uState) * uAudio * .014;
    p += vec3(sin(uTime + aSeed * 31.0), cos(uTime * .83 + aSeed * 19.0), 0.0) * amp;
    vPulse = .5 + .5 * sin(uTime * (1.0 + active) + aSeed * 23.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const lineFragment = /* glsl */`
  precision highp float;
  uniform float uState;
  uniform float uAudio;
  varying float vPulse;
  void main() {
    float active = step(1.5, uState);
    vec3 color = mix(vec3(.02, .34, .64), vec3(0.0, .9, 1.0), vPulse);
    float alpha = .075 + active * .055 + step(3.5, uState) * uAudio * .11;
    gl_FragColor = vec4(color, alpha);
  }
`;

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function buildHead() {
  const random = mulberry32(0x4b414c54);
  const positions = new Float32Array(POINT_COUNT * 3);
  const seeds = new Float32Array(POINT_COUNT);
  const regions = new Float32Array(POINT_COUNT);
  const points = [];
  const setPoint = (i, x, y, z, region = 0) => {
    positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z;
    seeds[i] = random(); regions[i] = region; points.push([x, y, z, seeds[i]]);
  };
  for (let i = 0; i < 1740; i++) {
    const yNorm = random() * 2 - 1;
    const theta = random() * Math.PI * 2;
    const temple = .92 + .08 * Math.cos(yNorm * Math.PI);
    const jaw = yNorm < -.28 ? 1 - (-yNorm - .28) * .33 : 1;
    const crown = yNorm > .72 ? 1 - (yNorm - .72) * .35 : 1;
    const rx = .43 * temple * jaw * crown;
    const rz = .37 * (.94 + .06 * Math.cos(yNorm * Math.PI));
    let x = Math.sin(theta) * rx;
    let y = .31 + yNorm * .62;
    let z = Math.cos(theta) * rz;
    const front = Math.max(0, Math.cos(theta));
    const nose = Math.exp(-Math.pow(x / .075, 2) - Math.pow((y - .23) / .19, 2));
    const lips = Math.exp(-Math.pow(x / .17, 2) - Math.pow((y + .04) / .055, 2));
    z += front * (nose * .105 + lips * .025);
    x += (random() - .5) * .012; y += (random() - .5) * .012; z += (random() - .5) * .012;
    setPoint(i, x, y, z, y < .03 && front > .75 ? 2 : 0);
  }
  for (let i = 1740; i < 2040; i++) {
    const a = random() * Math.PI * 2;
    const y = -.48 + random() * .34;
    const radius = .17 + (y < -.38 ? (-y - .38) * .45 : 0);
    setPoint(i, Math.sin(a) * radius, y, Math.cos(a) * radius * .78, 1);
  }
  for (let i = 2040; i < POINT_COUNT; i++) {
    const a = random() * Math.PI * 2;
    const t = random();
    const x = (random() * 2 - 1) * (.28 + t * .76);
    const shoulder = Math.sqrt(Math.max(0, 1 - Math.pow(x / 1.02, 2)));
    const y = -.55 - (1 - shoulder) * .27 - random() * .22;
    const z = Math.cos(a) * .2 * shoulder + .02;
    setPoint(i, x, y, z, 1);
  }
  const cell = .13;
  const grid = new Map();
  const keyOf = p => `${Math.floor(p[0] / cell)},${Math.floor(p[1] / cell)},${Math.floor(p[2] / cell)}`;
  points.forEach((p, i) => { const key = keyOf(p); const bucket = grid.get(key) || []; bucket.push(i); grid.set(key, bucket); });
  const pairs = [];
  for (let i = 0; i < points.length && pairs.length < 1850; i += 2) {
    const p = points[i];
    const gx = Math.floor(p[0] / cell), gy = Math.floor(p[1] / cell), gz = Math.floor(p[2] / cell);
    let linked = 0;
    for (let dx = -1; dx <= 1 && linked < 2; dx++) for (let dy = -1; dy <= 1 && linked < 2; dy++)
      for (let dz = -1; dz <= 1 && linked < 2; dz++) {
        const bucket = grid.get(`${gx + dx},${gy + dy},${gz + dz}`) || [];
        for (const j of bucket) {
          if (j <= i || linked >= 2) continue;
          const q = points[j]; const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
          if (d > .035 && d < .105 && random() > .53) { pairs.push([i, j]); linked++; }
        }
      }
  }
  const linePositions = new Float32Array(pairs.length * 6);
  const lineSeeds = new Float32Array(pairs.length * 2);
  pairs.forEach(([a, b], i) => {
    linePositions.set(positions.subarray(a * 3, a * 3 + 3), i * 6);
    linePositions.set(positions.subarray(b * 3, b * 3 + 3), i * 6 + 3);
    lineSeeds[i * 2] = seeds[a]; lineSeeds[i * 2 + 1] = seeds[b];
  });
  return { positions, seeds, regions, linePositions, lineSeeds };
}

function FeatureGlow({ audioRef, stateRef }) {
  const eyes = useRef(), ears = useRef(), triangle = useRef();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime, state = stateRef.current;
    const listen = state === 2 ? 1 : 0, speak = state === 4 ? 1 : 0;
    const pulse = 1 + Math.sin(t * (listen ? 5 : 2.1)) * .08 + speak * audioRef.current * .22;
    eyes.current?.scale.setScalar(pulse);
    ears.current?.scale.setScalar(1 + Math.sin(t * 2.8) * .06 + listen * .12);
    if (triangle.current) triangle.current.rotation.z = Math.sin(t * .7) * .03;
  });
  return <>
    <group ref={eyes}>{[-1, 1].map(side => <group key={side} position={[side * .145, .33, .37]}>
      <mesh scale={[.07, .023, .018]}><sphereGeometry args={[1, 16, 10]} /><meshBasicMaterial color="#ffffff" toneMapped={false} /></mesh>
      <pointLight color="#dffcff" intensity={.7} distance={.48} />
    </group>)}</group>
    <group ref={ears}>{[-1, 1].map(side => <group key={side} position={[side * .425, .22, 0]}>
      <mesh scale={[.026, .055, .025]}><sphereGeometry args={[1, 12, 10]} /><meshBasicMaterial color="#ff9d2e" toneMapped={false} /></mesh>
      <pointLight color="#ff8a1f" intensity={.45} distance={.38} />
    </group>)}</group>
    <group ref={triangle} position={[0, .53, .373]} rotation={[0, 0, Math.PI]}>
      <mesh><ringGeometry args={[.035, .046, 3]} /><meshBasicMaterial color="#00e5ff" transparent opacity={.95} side={THREE.DoubleSide} toneMapped={false} /></mesh>
      <pointLight color="#00e5ff" intensity={.35} distance={.36} />
    </group>
  </>;
}

function NeuralHead({ audioSource, reducedMotion }) {
  const group = useRef();
  const audioRef = useRef(0), stateRef = useRef(0), bootRef = useRef(0);
  const data = useMemo(buildHead, []);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uState: { value: 0 }, uAudio: { value: 0 }, uBoot: { value: 0 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 1.35) }, uCyan: { value: CYAN }, uBlue: { value: BLUE }
  }), []);
  const lineUniforms = useMemo(() => ({ uTime: { value: 0 }, uState: { value: 0 }, uAudio: { value: 0 }, uBoot: { value: 0 } }), []);
  useFrame(({ clock, pointer }, dt) => {
    const rawState = audioSource?.state || "standby";
    const state = rawState === "listening" ? 2 : rawState === "thinking" || rawState === "tool" ? 3 : rawState === "speaking" ? 4 : 1;
    stateRef.current = bootRef.current < .98 ? 0 : state;
    bootRef.current = Math.min(1, bootRef.current + dt * (reducedMotion ? 4 : .48));
    const nextAudio = state === 4 ? Math.max(.08, audioSource?.outputLevel || 0) : 0;
    audioRef.current = THREE.MathUtils.lerp(audioRef.current, nextAudio, Math.min(1, dt * 10));
    for (const set of [uniforms, lineUniforms]) {
      set.uTime.value = clock.elapsedTime; set.uState.value = stateRef.current;
      set.uAudio.value = audioRef.current; set.uBoot.value = bootRef.current;
    }
    if (group.current) {
      const think = state === 3 ? 1 : 0;
      const targetY = reducedMotion ? 0 : pointer.x * .2 + Math.sin(clock.elapsedTime * .19) * (.04 + think * .04);
      const targetX = reducedMotion ? 0 : -pointer.y * .1 + Math.sin(clock.elapsedTime * .31) * .018;
      group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, targetY, Math.min(1, dt * 2.4));
      group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, targetX, Math.min(1, dt * 2.4));
      group.current.position.y = reducedMotion ? 0 : Math.sin(clock.elapsedTime * .72) * .015;
    }
  });
  return <group ref={group} position={[0, .07, 0]}>
    <lineSegments frustumCulled={false}><bufferGeometry>
      <bufferAttribute attach="attributes-position" args={[data.linePositions, 3]} />
      <bufferAttribute attach="attributes-aSeed" args={[data.lineSeeds, 1]} />
    </bufferGeometry><shaderMaterial vertexShader={lineVertex} fragmentShader={lineFragment} uniforms={lineUniforms}
      transparent depthWrite={false} blending={THREE.AdditiveBlending} /></lineSegments>
    <points frustumCulled={false}><bufferGeometry>
      <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
      <bufferAttribute attach="attributes-aSeed" args={[data.seeds, 1]} />
      <bufferAttribute attach="attributes-aRegion" args={[data.regions, 1]} />
    </bufferGeometry><shaderMaterial vertexShader={pointVertex} fragmentShader={pointFragment} uniforms={uniforms}
      transparent depthWrite={false} blending={THREE.AdditiveBlending} /></points>
    <FeatureGlow audioRef={audioRef} stateRef={stateRef} />
  </group>;
}

function StateHalo({ audioSource, reducedMotion }) {
  const halo = useRef();
  useFrame((_, dt) => {
    if (!halo.current) return;
    const state = audioSource?.state || "standby";
    const speed = state === "thinking" || state === "tool" ? .2 : state === "listening" ? .08 : .025;
    if (!reducedMotion) halo.current.rotation.z += dt * speed;
    halo.current.scale.setScalar(1 + (state === "speaking" ? (audioSource?.outputLevel || 0) * .035 : 0));
  });
  return <group ref={halo}>{[1.1, 1.19, 1.3].map((radius, i) => <mesh key={radius} rotation={[0, 0, i * .23]}>
    <torusGeometry args={[radius, i === 1 ? .004 : .002, 4, 180]} />
    <meshBasicMaterial color={i === 1 ? "#197dff" : "#00e5ff"} transparent opacity={.15 + i * .055}
      depthWrite={false} blending={THREE.AdditiveBlending} />
  </mesh>)}</group>;
}

class AvatarBoundary extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) {
    window.Kaltron3DReady = false;
    document.getElementById("reactorWrap")?.classList.remove("genie-3d-ready");
    console.warn("KALTRON neural avatar unavailable; particle fallback active", error);
  }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function KaltronAvatar3D({ audioSource }) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  useEffect(() => () => {
    window.Kaltron3DReady = false;
    document.getElementById("reactorWrap")?.classList.remove("genie-3d-ready");
  }, []);
  return <div className="kaltron-3d-stage" aria-hidden="true"><AvatarBoundary>
    <Canvas camera={{ position: [0, 0, 3.35], fov: 39, near: .1, far: 12 }} dpr={1}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        window.Kaltron3DReady = true;
        document.getElementById("reactorWrap")?.classList.add("genie-3d-ready");
        gl.setClearColor(0x000000, 0);
        gl.domElement.addEventListener("webglcontextlost", () => {
          window.Kaltron3DReady = false;
          document.getElementById("reactorWrap")?.classList.remove("genie-3d-ready");
        }, { once: true });
      }}>
      <NeuralHead audioSource={audioSource} reducedMotion={reducedMotion} />
      <StateHalo audioSource={audioSource} reducedMotion={reducedMotion} />
    </Canvas>
  </AvatarBoundary></div>;
}
