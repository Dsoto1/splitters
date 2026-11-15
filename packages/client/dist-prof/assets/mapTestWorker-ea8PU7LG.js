const scope = self;
const post = (m) => scope.postMessage(m);
scope.onmessage = (e) => {
  import("./mapTestWorkerCore-DMhbVt_k.js").then(function(n) {
    return n.dM;
  }).then((c) => c.runMapTest(e.data, post)).catch((err) => post({ k: "failed", error: err.message }));
};
