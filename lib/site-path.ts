// Next.js inlines this value from next.config.mjs into the production bundle.
// Native <img>, <audio> and <a> elements need the public prefix explicitly.
export function sitePath(path: string) {
  return `${process.env.NEXT_PUBLIC_BASE_PATH || ''}${path}`;
}
