import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'util';

// react-router needs these, and the CRA jsdom environment does not provide them
Object.assign(global, { TextEncoder, TextDecoder });
