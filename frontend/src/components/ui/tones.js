// Full class names per colour, written out so Tailwind keeps them in the build.
export const TONES = {
  blue: { text: 'text-blue-ink', bg: 'bg-blue', soft: 'bg-blue-soft', ring: 'ring-blue/30', stroke: '#007aff', border: 'border-blue/30' },
  green: { text: 'text-green-ink', bg: 'bg-green', soft: 'bg-green-soft', ring: 'ring-green/30', stroke: '#34c759', border: 'border-green/30' },
  orange: { text: 'text-orange-ink', bg: 'bg-orange', soft: 'bg-orange-soft', ring: 'ring-orange/30', stroke: '#ff9500', border: 'border-orange/30' },
  red: { text: 'text-red-ink', bg: 'bg-red', soft: 'bg-red-soft', ring: 'ring-red/30', stroke: '#ff3b30', border: 'border-red/30' },
  yellow: { text: 'text-yellow-ink', bg: 'bg-yellow', soft: 'bg-yellow-soft', ring: 'ring-yellow/40', stroke: '#ffcc00', border: 'border-yellow/40' },
  purple: { text: 'text-purple-ink', bg: 'bg-purple', soft: 'bg-purple-soft', ring: 'ring-purple/30', stroke: '#af52de', border: 'border-purple/30' },
  indigo: { text: 'text-indigo-ink', bg: 'bg-indigo', soft: 'bg-indigo-soft', ring: 'ring-indigo/30', stroke: '#5856d6', border: 'border-indigo/30' },
  teal: { text: 'text-teal-ink', bg: 'bg-teal', soft: 'bg-teal-soft', ring: 'ring-teal/30', stroke: '#30b0c7', border: 'border-teal/30' },
  pink: { text: 'text-pink-ink', bg: 'bg-pink', soft: 'bg-pink-soft', ring: 'ring-pink/30', stroke: '#ff2d55', border: 'border-pink/30' },
  gray: { text: 'text-graphite', bg: 'bg-silver', soft: 'bg-mist', ring: 'ring-black/10', stroke: '#86868b', border: 'border-hairline' },
};

// One colour per product area, used consistently across the site
export const AREA = {
  salary: 'green',
  resume: 'blue',
  jobs: 'purple',
  hr: 'teal',
  profile: 'orange',
};

/** Colour for a 0-100 score: red, orange, then green. */
export function scoreTone(score) {
  if (score >= 80) return 'green';
  if (score >= 60) return 'orange';
  return 'red';
}

/** Colour for a 0-1 match ratio. */
export function matchTone(ratio) {
  if (ratio >= 0.8) return 'green';
  if (ratio >= 0.6) return 'orange';
  return 'red';
}

export const tone = (name) => TONES[name] || TONES.gray;
