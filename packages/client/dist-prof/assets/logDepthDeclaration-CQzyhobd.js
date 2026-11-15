import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
const name = "logDepthDeclaration";
const shader = `#ifdef LOGARITHMICDEPTH
uniform float logarithmicDepthConstant;varying float vFragmentDepth;
#endif
`;
if (!ShaderStore.IncludesShadersStore[name]) {
  ShaderStore.IncludesShadersStore[name] = shader;
}
const logDepthDeclaration = { name, shader };
export {
  logDepthDeclaration
};
