import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'util';

// react-router needs these, and the CRA jsdom environment does not provide them
Object.assign(global, { TextEncoder, TextDecoder });

// jsdom has no ResizeObserver either; components that measure themselves need one
if (!global.ResizeObserver) {
  global.ResizeObserver = class {
    observe() {}

    unobserve() {}

    disconnect() {}
  };
}

// Or IntersectionObserver (used by "animate when it comes into view") or scrollTo
if (!global.IntersectionObserver) {
  global.IntersectionObserver = class {
    observe() {}

    unobserve() {}

    disconnect() {}

    takeRecords() { return []; }
  };
}
window.scrollTo = () => {};
