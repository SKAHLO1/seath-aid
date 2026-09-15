// SPDX-License-Identifier: Apache-2.0
//
// Browser shim for `isomorphic-ws`.
//
// midnight-js-indexer-public-data-provider does `import * as ws from
// 'isomorphic-ws'` and then reads `ws.WebSocket`. The package's browser build
// only has `export default`, with no named `WebSocket`, so Turbopack's static
// ESM analysis fails the build outright:
//
//   Export WebSocket doesn't exist in target module
//
// Node builds are fine because isomorphic-ws/node.js re-exports the `ws`
// package's named bindings; only the browser entry is short. This shim
// provides BOTH shapes so either import style resolves. It is aliased in
// next.config.mjs for the browser condition only.

const impl: typeof WebSocket | undefined =
  typeof WebSocket !== "undefined" ? WebSocket : undefined;

export { impl as WebSocket };
export default impl;
