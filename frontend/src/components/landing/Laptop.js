import React from 'react';
import { motion, useTransform } from 'framer-motion';

/*
 * A Space Black laptop built from CSS planes in real 3D.
 *
 * Every size is in cqw (percent of the lid width), so the model stays proportional
 * and razor sharp at any screen size or pixel density. Nothing is ever scaled up:
 * the camera moves instead, and at the end every transform returns to identity,
 * so the display is drawn at native resolution.
 */

// Keyboard layout as flex widths. 'arrows' is the inverted-T cluster.
const ROWS = [
  { h: 2.3, keys: [1.5, ...Array(12).fill(1), 1] }, // esc, F1-F12, Touch ID
  { h: 4.3, keys: [...Array(13).fill(1), 1.5] }, // numbers, delete
  { h: 4.3, keys: [1.5, ...Array(13).fill(1)] }, // tab, letters
  { h: 4.3, keys: [1.8, ...Array(11).fill(1), 1.8] }, // caps lock, return
  { h: 4.3, keys: [2.35, ...Array(10).fill(1), 2.35] }, // shifts
  { h: 4.3, keys: [1, 1, 1, 1.25, 5.25, 1.25, 1, 'arrows'] }, // fn ctrl opt cmd space cmd opt arrows
];

const KEY =
  'rounded-[0.45cqw] bg-[linear-gradient(180deg,#1c1c1f_0%,#131315_100%)] ' +
  'shadow-[inset_0_0.07cqw_0_rgba(255,255,255,0.10),0_0.1cqw_0_#040405]';

function ArrowKeys() {
  return (
    <div className="flex gap-[0.45cqw]" style={{ flex: 3 }}>
      <span className={`${KEY} mt-auto h-1/2 flex-1`} />
      <span className="flex flex-1 flex-col gap-[0.2cqw]">
        <span className={`${KEY} flex-1`} />
        <span className={`${KEY} flex-1`} />
      </span>
      <span className={`${KEY} mt-auto h-1/2 flex-1`} />
    </div>
  );
}

function Keyboard() {
  return (
    <div className="absolute left-[15cqw] right-[15cqw] top-[3.4cqw] flex flex-col gap-[0.5cqw] rounded-[0.9cqw] bg-[#09090a] p-[0.55cqw] shadow-[inset_0_0.15cqw_0.5cqw_rgba(0,0,0,0.9),0_0.07cqw_0_rgba(255,255,255,0.07)]">
      {ROWS.map((row, r) => (
        <div key={r} className="flex gap-[0.45cqw]" style={{ height: `${row.h}cqw` }}>
          {row.keys.map((k, i) => (k === 'arrows'
            ? <ArrowKeys key={i} />
            : <span key={i} className={KEY} style={{ flex: k }} />))}
        </div>
      ))}
    </div>
  );
}

// Perforated speaker grille either side of the keyboard
const GRILLE = {
  backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.75) 0 32%, transparent 38%)',
  backgroundSize: '0.62cqw 0.62cqw',
};

// Lid and base share one footprint so they line up exactly when closed.
// Lid height = 0.44 rim + 1.65 + 2.1 bezel + 96.46 * 10/16 screen = 64.5cqw
const DEPTH = '64.5cqw';
const RADIUS = '2.4cqw';
const LID_THICKNESS = '1.1cqw';

function Deck() {
  return (
    <div
      className="absolute inset-x-0 top-full"
      style={{ height: DEPTH, transform: 'rotateX(90deg)', transformOrigin: '50% 0%', transformStyle: 'preserve-3d' }}
    >
      {/* Soft shadow on the floor under the laptop */}
      <div
        className="absolute -inset-[5cqw] rounded-[8cqw] bg-[radial-gradient(closest-side,rgba(0,0,0,0.38),rgba(0,0,0,0.12)_60%,transparent)]"
        style={{ transform: 'translateZ(-1.6cqw)' }}
      />

      {/* Top surface */}
      <div className="absolute inset-0 overflow-hidden rounded-b-[2.4cqw] rounded-t-[0.6cqw] bg-[linear-gradient(180deg,#1f2023_0%,#2b2c30_28%,#27282b_70%,#212225_100%)] shadow-[inset_0_0_0_0.12cqw_rgba(255,255,255,0.07)]">
        {/* Sheen from the overhead light */}
        <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_10%,rgba(255,255,255,0.07),transparent)]" />
        <div className="absolute left-[2.6cqw] top-[3.4cqw] h-[27.4cqw] w-[10.4cqw] rounded-[0.6cqw]" style={GRILLE} />
        <div className="absolute right-[2.6cqw] top-[3.4cqw] h-[27.4cqw] w-[10.4cqw] rounded-[0.6cqw]" style={GRILLE} />
        <Keyboard />
        {/* Glass trackpad */}
        <div className="absolute left-[29cqw] right-[29cqw] top-[35.4cqw] h-[23cqw] rounded-[1.4cqw] bg-[linear-gradient(180deg,#2e2f33_0%,#26272a_100%)] shadow-[inset_0_0_0_0.1cqw_rgba(255,255,255,0.09),inset_0_0.1cqw_0.3cqw_rgba(0,0,0,0.35)]" />
      </div>

      {/* Front edge: the slab's thickness, facing the viewer */}
      <div
        className="absolute inset-x-[1.2cqw] bottom-0 h-[1.5cqw] rounded-b-[1.2cqw_0.9cqw] bg-[linear-gradient(180deg,#45464b_0%,#26272a_38%,#151517_100%)] shadow-[inset_0_0.09cqw_0_rgba(255,255,255,0.28)]"
        style={{ transform: 'rotateX(-90deg)', transformOrigin: '50% 100%' }}
      >
        {/* Thumb notch for opening the lid */}
        <div className="absolute left-1/2 top-0 h-[48%] w-[11cqw] -translate-x-1/2 rounded-b-[0.8cqw] bg-[linear-gradient(180deg,#121214,#2a2b2e)]" />
        {/* Contact shadow where it meets the floor */}
        <div className="absolute inset-x-[-3cqw] top-full h-[3.6cqw] bg-[radial-gradient(50%_100%_at_50%_0%,rgba(0,0,0,0.42)_0%,rgba(0,0,0,0.12)_45%,transparent_100%)]" />
      </div>
    </div>
  );
}

function LidFront({ screenOpacity, children }) {
  return (
    // Thin anodised rim around the glass, catching the light on top
    <div
      className="relative rounded-t-[2.7cqw] rounded-b-[0.9cqw] bg-[linear-gradient(180deg,#56575d_0%,#2a2b2f_18%,#1a1b1e_100%)] p-[0.22cqw]"
      style={{ backfaceVisibility: 'hidden' }}
    >
      <div className="relative rounded-t-[2.5cqw] rounded-b-[0.7cqw] bg-[#030304] px-[1.55cqw] pb-[2.1cqw] pt-[1.65cqw]">
        {/* Camera housing */}
        <div className="absolute left-1/2 top-0 z-10 flex h-[2.25cqw] w-[10cqw] -translate-x-1/2 items-center justify-center rounded-b-[0.95cqw] bg-[#030304]">
          <span className="h-[0.62cqw] w-[0.62cqw] rounded-full bg-[radial-gradient(circle_at_35%_35%,#3d4a66_0%,#141a28_55%,#050608_100%)] shadow-[0_0_0_0.08cqw_#16171a]" />
        </div>

        <div className="relative aspect-[16/10] overflow-hidden rounded-t-[1.05cqw] rounded-b-[0.25cqw] bg-black [container-type:inline-size]">
          <motion.div className="absolute inset-0" style={{ opacity: screenOpacity }}>
            {children}
          </motion.div>
          {/* Glass: a broad reflection plus a bright edge along the top */}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(118deg,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0.03)_34%,rgba(255,255,255,0)_46%)]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/20" />
        </div>
      </div>
    </div>
  );
}

function LidBack() {
  return (
    <div
      className="absolute inset-0 overflow-hidden bg-[linear-gradient(180deg,#2a2b2f_0%,#232427_55%,#1c1d20_100%)] shadow-[inset_0_0_0_0.14cqw_rgba(255,255,255,0.09)]"
      style={{ borderRadius: RADIUS, transform: `translateZ(-${LID_THICKNESS}) rotateY(180deg)`, backfaceVisibility: 'hidden' }}
    >
      {/* Soft light sweeping across the metal */}
      <div className="absolute inset-0 bg-[linear-gradient(112deg,rgba(255,255,255,0)_18%,rgba(255,255,255,0.075)_42%,rgba(255,255,255,0.02)_56%,rgba(255,255,255,0)_70%)]" />
      {/* Polished edge where the chamfer catches the light */}
      <div className="absolute inset-[0.35cqw] shadow-[inset_0_0_0_0.06cqw_rgba(255,255,255,0.06)]" style={{ borderRadius: '2.1cqw' }} />
      {/* Etched wordmark, turned so it reads upright to the viewer while the lid is closed */}
      <div className="absolute inset-0 flex rotate-180 items-center justify-center">
        <span className="font-display text-[3.3cqw] font-semibold tracking-[-0.01em] text-[#66676d] [text-shadow:0_0.06cqw_0_rgba(255,255,255,0.07),0_-0.04cqw_0_rgba(0,0,0,0.45)]">
          SkillLens
        </span>
      </div>
    </div>
  );
}

/** The lid's thickness, seen along its top edge (the front of the laptop when closed). */
function LidEdge({ opacity }) {
  return (
    <motion.div
      className="absolute inset-x-[1.1cqw] top-0 rounded-[0.6cqw] bg-[linear-gradient(180deg,#2b2c30,#1f2023)] shadow-[inset_0_0.06cqw_0_rgba(255,255,255,0.12)]"
      style={{ height: LID_THICKNESS, opacity, transform: 'rotateX(-90deg)', transformOrigin: '50% 0%' }}
    />
  );
}

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * `open` is a motion value from 0 (closed, seen from above) to 1 (open, facing you).
 * The lid swings up while the camera drops to eye level.
 */
function Laptop({ open, screenOpacity, children }) {
  const eased = useTransform(open, (v) => easeInOut(Math.min(1, Math.max(0, v))));
  const lidAngle = useTransform(eased, [0, 1], [-90, 0]);
  // Negative tilt leans the laptop toward you, so the closed lid and keyboard face the camera
  const tilt = useTransform(eased, [0, 1], [-34, 0]);
  const eyeLevel = useTransform(eased, (v) => `50% ${-30 + v * 102}%`);
  // Starts further from the camera and comes forward as it opens, ending at z = 0 (native size)
  const depth = useTransform(eased, (v) => `${-110 * (1 - v)}cqw`);
  const lift = useTransform(eased, (v) => `${-34 * (1 - v)}cqw`);
  // The lid's edge only faces the camera while it is nearly closed. Switched off rather than
  // faded, because a half-transparent strip in 3D shows up as a pale bar.
  const edgeOpacity = useTransform(eased, (v) => (v < 0.12 ? 1 : 0));

  return (
    <div className="relative mx-auto w-full md:w-[86%] [container-type:inline-size]">
      <motion.div style={{ perspective: '480cqw', perspectiveOrigin: eyeLevel }}>
        <motion.div style={{ z: depth, y: lift, rotateX: tilt, transformOrigin: '50% 100%', transformStyle: 'preserve-3d' }}>
          <motion.div
            className="relative"
            style={{ rotateX: lidAngle, transformOrigin: '50% 100%', transformStyle: 'preserve-3d' }}
          >
            <LidFront screenOpacity={screenOpacity}>{children}</LidFront>
            <LidBack />
            <LidEdge opacity={edgeOpacity} />
          </motion.div>
          <Deck />
        </motion.div>
      </motion.div>
    </div>
  );
}

export default Laptop;
