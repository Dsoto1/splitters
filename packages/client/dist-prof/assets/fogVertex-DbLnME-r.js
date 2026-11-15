import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
const name$1 = "fogVertexDeclaration";
const shader$1 = `#ifdef FOG
varying vec3 vFogDistance;
#endif
`;
if (!ShaderStore.IncludesShadersStore[name$1]) {
  ShaderStore.IncludesShadersStore[name$1] = shader$1;
}
const fogVertexDeclaration = { name: name$1, shader: shader$1 };
const name = "fogVertex";
const shader = `#ifdef FOG
vFogDistance=(view*worldPos).xyz;
#endif
`;
if (!ShaderStore.IncludesShadersStore[name]) {
  ShaderStore.IncludesShadersStore[name] = shader;
}
const fogVertex = { name, shader };
export {
  fogVertex as a,
  fogVertexDeclaration as f
};
