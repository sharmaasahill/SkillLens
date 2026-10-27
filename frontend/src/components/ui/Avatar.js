import React from 'react';
import { cx } from './primitives';

/** A round profile photo, or a soft person shape when there is no photo yet. */
function Avatar({ src, size = 24, alt = '', className = '' }) {
  const box = { width: size, height: size };
  if (src) {
    return <img src={src} alt={alt} width={size} height={size} style={box} className={cx('shrink-0 rounded-full object-cover', className)} />;
  }
  return (
    <span style={box} className={cx('flex shrink-0 items-center justify-center rounded-full bg-mist text-silver', className)} aria-hidden="true">
      <svg viewBox="0 0 24 24" className="h-[55%] w-[55%]" fill="currentColor">
        <path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.4 0-8 2.5-8 5.5V21h16v-1.5c0-3-3.6-5.5-8-5.5Z" />
      </svg>
    </span>
  );
}

export default Avatar;
