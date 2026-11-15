const scope = self;
const post = (m, transfer) => scope.postMessage(m, transfer ?? []);
const core = import("./simWorkerCore-ChXicRX9.js").then(function(n) {
  return n.eA;
});
let host = null;
let queue = core;
function handle(c, m) {
  if (m.k === "warm") {
    void Promise.all([c.loadMatch().then((mod) => mod.initNavigation()), c.initPhysics()]).catch((err) => console.warn("match worker warm-up failed", err));
    return;
  }
  if (m.k === "start") {
    host = new c.MatchHost(m.map, m.opts, c.sinkTo(post));
    host.setHidden(m.hidden);
    host.start().catch((err) => post({ k: "failed", error: err.message }));
    return;
  }
  if (!host) return;
  c.dispatchToHost(host, m, post);
  if (m.k === "stop") {
    host = null;
    scope.close();
  }
}
scope.onmessage = (e) => {
  const m = e.data;
  queue = queue.then(() => core).then((c) => handle(c, m), (err) => {
    if (m.k === "start") post({ k: "failed", error: `the match code didn't load: ${err.message}` });
  });
};
