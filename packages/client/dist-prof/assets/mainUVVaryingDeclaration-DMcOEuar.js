import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
const name = "mainUVVaryingDeclaration";
const shader = `#ifdef MAINUV{X}
varying vMainUV{X}: vec2f;
#endif
`;
if (!ShaderStore.IncludesShadersStoreWGSL[name]) {
  ShaderStore.IncludesShadersStoreWGSL[name] = shader;
}
const mainUVVaryingDeclarationWGSL = { name, shader };
export {
  mainUVVaryingDeclarationWGSL as m
};
