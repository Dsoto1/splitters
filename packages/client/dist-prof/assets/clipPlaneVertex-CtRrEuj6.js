import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
const name$1 = "clipPlaneVertexDeclaration";
const shader$1 = `#ifdef CLIPPLANE
uniform vClipPlane: vec4<f32>;varying fClipDistance: f32;
#endif
#ifdef CLIPPLANE2
uniform vClipPlane2: vec4<f32>;varying fClipDistance2: f32;
#endif
#ifdef CLIPPLANE3
uniform vClipPlane3: vec4<f32>;varying fClipDistance3: f32;
#endif
#ifdef CLIPPLANE4
uniform vClipPlane4: vec4<f32>;varying fClipDistance4: f32;
#endif
#ifdef CLIPPLANE5
uniform vClipPlane5: vec4<f32>;varying fClipDistance5: f32;
#endif
#ifdef CLIPPLANE6
uniform vClipPlane6: vec4<f32>;varying fClipDistance6: f32;
#endif
`;
if (!ShaderStore.IncludesShadersStoreWGSL[name$1]) {
  ShaderStore.IncludesShadersStoreWGSL[name$1] = shader$1;
}
const clipPlaneVertexDeclarationWGSL = { name: name$1, shader: shader$1 };
const clipPlaneVertexDeclaration = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  clipPlaneVertexDeclarationWGSL
}, Symbol.toStringTag, { value: "Module" }));
const name = "clipPlaneVertex";
const shader = `#ifdef CLIPPLANE
vertexOutputs.fClipDistance=dot(worldPos,uniforms.vClipPlane);
#endif
#ifdef CLIPPLANE2
vertexOutputs.fClipDistance2=dot(worldPos,uniforms.vClipPlane2);
#endif
#ifdef CLIPPLANE3
vertexOutputs.fClipDistance3=dot(worldPos,uniforms.vClipPlane3);
#endif
#ifdef CLIPPLANE4
vertexOutputs.fClipDistance4=dot(worldPos,uniforms.vClipPlane4);
#endif
#ifdef CLIPPLANE5
vertexOutputs.fClipDistance5=dot(worldPos,uniforms.vClipPlane5);
#endif
#ifdef CLIPPLANE6
vertexOutputs.fClipDistance6=dot(worldPos,uniforms.vClipPlane6);
#endif
`;
if (!ShaderStore.IncludesShadersStoreWGSL[name]) {
  ShaderStore.IncludesShadersStoreWGSL[name] = shader;
}
const clipPlaneVertexWGSL = { name, shader };
const clipPlaneVertex = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  clipPlaneVertexWGSL
}, Symbol.toStringTag, { value: "Module" }));
export {
  clipPlaneVertexWGSL as a,
  clipPlaneVertexDeclaration as b,
  clipPlaneVertexDeclarationWGSL as c,
  clipPlaneVertex as d
};
