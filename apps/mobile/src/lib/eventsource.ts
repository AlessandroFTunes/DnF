import RNEventSource from 'react-native-sse';

// O React Native não tem EventSource; o realtime da API (SSE) usa (ex.: a mesa ao vivo). Na web já existe.
globalThis.EventSource ??= RNEventSource as unknown as typeof EventSource;
