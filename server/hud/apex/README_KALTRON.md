# KALTRON APEX HUD bundle

`app/` and `components/` are copied from the supplied APEX-UI-main source. See `LICENSE` and `CREDITS.md`. KALTRON uses its own name and branding.

The live static entry is `dist/kaltron-genie.js` plus `dist/kaltron-genie.css`. `src/KaltronGenie.jsx` composes the APEX SVG orb and shader with the existing KALTRON voice page. `src/KaltronAvatar3D.jsx` renders an androgynous neural head from exactly 2,500 Three.js points. A spatial hash builds short local connections, while GLSL shaders drive assembly, drift, listening, thinking, and speech motion. White eyes, amber ear nodes, and an inverted cyan forehead triangle provide fixed landmarks. Mouse position adds subtle head parallax and Edge TTS output drives speech intensity. No remote model or texture is loaded. The old `../avatar.js` particle scene remains as a fallback if WebGL is unavailable; it also owns wake, clap, and audio analysis.

Avatar state mapping:

- `boot`: scattered points assemble into the face when fullscreen opens.
- `standby`: slow cyan and electric-blue breathing drift.
- `listening`: brighter pulse and faster eye/ear response.
- `thinking` / `tool`: stronger neural displacement and faster halo rotation.
- `speaking`: mouth-region points and brightness follow the PCM output analyser.

To rebuild on Windows from this directory, run `npm ci` and then `npm run build`. Only the generated `dist/` files are required at runtime. No CDN or Node server is used by the HUD.
