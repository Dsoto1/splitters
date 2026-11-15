import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
const name$1 = "clipPlaneFragmentDeclaration";
const shader$1 = `#ifdef CLIPPLANE
varying float fClipDistance;
#endif
#ifdef CLIPPLANE2
varying float fClipDistance2;
#endif
#ifdef CLIPPLANE3
varying float fClipDistance3;
#endif
#ifdef CLIPPLANE4
varying float fClipDistance4;
#endif
#ifdef CLIPPLANE5
varying float fClipDistance5;
#endif
#ifdef CLIPPLANE6
varying float fClipDistance6;
#endif
`;
if (!ShaderStore.IncludesShadersStore[name$1]) {
  ShaderStore.IncludesShadersStore[name$1] = shader$1;
}
const clipPlaneFragmentDeclaration = { name: name$1, shader: shader$1 };
const clipPlaneFragmentDeclaration$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  clipPlaneFragmentDeclaration
}, Symbol.toStringTag, { value: "Module" }));
const name = "clipPlaneFragment";
const shader = `#if defined(CLIPPLANE) || defined(CLIPPLANE2) || defined(CLIPPLANE3) || defined(CLIPPLANE4) || defined(CLIPPLANE5) || defined(CLIPPLANE6)
if (false) {}
#endif
#ifdef CLIPPLANE
else if (fClipDistance>0.0)
{discard;}
#endif
#ifdef CLIPPLANE2
else if (fClipDistance2>0.0)
{discard;}
#endif
#ifdef CLIPPLANE3
else if (fClipDistance3>0.0)
{discard;}
#endif
#ifdef CLIPPLANE4
else if (fClipDistance4>0.0)
{discard;}
#endif
#ifdef CLIPPLANE5
else if (fClipDistance5>0.0)
{discard;}
#endif
#ifdef CLIPPLANE6
else if (fClipDistance6>0.0)
{discard;}
#endif
`;
if (!ShaderStore.IncludesShadersStore[name]) {
  ShaderStore.IncludesShadersStore[name] = shader;
}
const clipPlaneFragment = { name, shader };
const clipPlaneFragment$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  clipPlaneFragment
}, Symbol.toStringTag, { value: "Module" }));
export {
  clipPlaneFragment as a,
  clipPlaneFragmentDeclaration$1 as b,
  clipPlaneFragmentDeclaration as c,
  clipPlaneFragment$1 as d
};
