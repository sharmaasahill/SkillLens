import React from 'react';
import { motion } from 'framer-motion';

const KEY_ROWS = [14, 14, 13, 12, 11];

/** Keyboard well with key caps, drawn on the deck surface. */
function Keyboard() {
  return (
    <div className="mx-auto mt-[4.5%] flex w-[84%] flex-col gap-[0.9%] rounded-[1.4%] bg-[#1c1c1e] p-[1%] shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]">
      {/* Function row */}
      <div className="flex gap-[0.6%]">
        {Array.from({ length: 14 }).map((_, i) => (
          <span key={i} className="h-[0.9cqw] flex-1 rounded-[0.2cqw] bg-[#2c2c2e]" />
        ))}
      </div>
      {KEY_ROWS.map((count, row) => (
        <div key={row} className="flex gap-[0.6%]">
          {Array.from({ length: count }).map((_, i) => {
            const wide = (row === 2 && (i === 0 || i === count - 1)) || (row === 3 && (i === 0 || i === count - 1));
            return (
              <span
                key={i}
                className="h-[1.9cqw] rounded-[0.25cqw] bg-[#2c2c2e] shadow-[0_1px_0_rgba(0,0,0,0.5)]"
                style={{ flex: wide ? 1.7 : 1 }}
              />
            );
          })}
          {row === 4 && <span className="h-[1.9cqw] rounded-[0.25cqw] bg-[#2c2c2e]" style={{ flex: 5 }} />}
        </div>
      ))}
    </div>
  );
}

/**
 * A MacBook-style laptop built from CSS planes in 3D.
 * `lidAngle` is a motion value in degrees: -90 = closed on the deck, 0 = open, facing the viewer.
 * The deck lies flat and extends toward the viewer, so the lid really closes onto it.
 */
function Laptop({ lidAngle, screenOpacity, children }) {
  return (
    <div className="relative mx-auto w-full" style={{ perspective: '2200px', perspectiveOrigin: '50% -10%' }}>
      <div className="relative mx-auto w-[82%]" style={{ transformStyle: 'preserve-3d' }}>
        {/* Lid */}
        <motion.div
          className="relative"
          style={{ rotateX: lidAngle, transformOrigin: '50% 100%', transformStyle: 'preserve-3d' }}
        >
          {/* Front: bezel and display */}
          <div
            className="relative rounded-t-[2.2%/3.4%] bg-[#0b0b0c] p-[1.55%] pb-[2.4%] shadow-[0_0_0_1px_rgba(0,0,0,0.6),0_1px_0_1px_#2a2a2c_inset]"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="absolute left-1/2 top-0 z-10 h-[2.6%] w-[9%] -translate-x-1/2 rounded-b-[6px] bg-[#0b0b0c]" />
            <div className="relative aspect-[16/10] overflow-hidden rounded-[0.6%] bg-black [container-type:inline-size]">
              <motion.div className="absolute inset-0" style={{ opacity: screenOpacity }}>
                {children}
              </motion.div>
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.07)_0%,rgba(255,255,255,0)_38%)]" />
            </div>
          </div>

          {/* Back: aluminium, visible while the lid is closed */}
          <div
            className="absolute inset-0 rounded-t-[2.2%/3.4%] bg-[linear-gradient(0deg,#eceded_0%,#d9dadc_60%,#cfd0d3_100%)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.7)]"
            style={{ transform: 'rotateY(180deg)', backfaceVisibility: 'hidden' }}
          >
            <div className="absolute left-1/2 top-1/2 h-[10%] w-[6.5%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_40%_35%,#fafafa,#c2c4c7)] opacity-80" />
          </div>
        </motion.div>

        {/* Deck: lies flat from the hinge toward the viewer */}
        <div
          className="absolute left-[-1.5%] right-[-1.5%] top-full aspect-[16/10.4]"
          style={{ transform: 'rotateX(90deg)', transformOrigin: '50% 0%', transformStyle: 'preserve-3d' }}
        >
          <div className="absolute inset-0 rounded-b-[3%] rounded-t-[1%] bg-[linear-gradient(180deg,#d6d7da_0%,#e4e5e7_35%,#dcdde0_100%)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.65)] [container-type:inline-size]">
            <Keyboard />
            {/* Trackpad */}
            <div className="absolute bottom-[6%] left-1/2 h-[31%] w-[40%] -translate-x-1/2 rounded-[2.2cqw] bg-[linear-gradient(180deg,#d0d1d4,#d9dadd)] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]" />
          </div>
          {/* Front lip, standing up at the near edge of the deck */}
          <div
            className="absolute inset-x-0 bottom-0 h-[2.2cqw] max-h-[14px] min-h-[6px] rounded-b-[999px] bg-[linear-gradient(180deg,#c9cacd_0%,#a7a9ad_100%)]"
            style={{ transform: 'rotateX(-90deg)', transformOrigin: '50% 100%' }}
          >
            <div className="absolute left-1/2 top-0 h-[45%] w-[13%] -translate-x-1/2 rounded-b-[8px] bg-[#b4b6b9]" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Laptop;
