export default function Loading() {
  // Keep the root route fallback invisible. The terminal has its own component
  // loading states, and a full-screen root fallback can linger in browser
  // sessions even after the streamed page payload has arrived.
  return null;
}
