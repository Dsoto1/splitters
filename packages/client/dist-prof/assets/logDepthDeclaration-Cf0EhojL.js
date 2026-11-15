import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
const name = "logDepthDeclaration";
const shader = `#ifdef LOGARITHMICDEPTH
uniform logarithmicDepthConstant: f32;varying vFragmentDepth: f32;
#endif
`;
if (!ShaderStore.IncludesShadersStoreWGSL[name]) {
  ShaderStore.IncludesShadersStoreWGSL[name] = shader;
}
const logDepthDeclarationWGSL = { name, shader };
export {
  logDepthDeclarationWGSL
};
