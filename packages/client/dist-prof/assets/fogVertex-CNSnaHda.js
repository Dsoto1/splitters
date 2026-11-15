import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
const name$1 = "fogVertexDeclaration";
const shader$1 = `#ifdef FOG
varying vFogDistance: vec3f;
#endif
`;
if (!ShaderStore.IncludesShadersStoreWGSL[name$1]) {
  ShaderStore.IncludesShadersStoreWGSL[name$1] = shader$1;
}
const fogVertexDeclarationWGSL = { name: name$1, shader: shader$1 };
const name = "fogVertex";
const shader = `#ifdef FOG
#ifdef SCENE_UBO
vertexOutputs.vFogDistance=(scene.view*worldPos).xyz;
#else
vertexOutputs.vFogDistance=(uniforms.view*worldPos).xyz;
#endif
#endif
`;
if (!ShaderStore.IncludesShadersStoreWGSL[name]) {
  ShaderStore.IncludesShadersStoreWGSL[name] = shader;
}
const fogVertexWGSL = { name, shader };
export {
  fogVertexWGSL as a,
  fogVertexDeclarationWGSL as f
};
