import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
const name = "logDepthFragment";
const shader = `#ifdef LOGARITHMICDEPTH
fragmentOutputs.fragDepth=log2(fragmentInputs.vFragmentDepth)*uniforms.logarithmicDepthConstant*0.5;
#endif
`;
if (!ShaderStore.IncludesShadersStoreWGSL[name]) {
  ShaderStore.IncludesShadersStoreWGSL[name] = shader;
}
const logDepthFragmentWGSL = { name, shader };
export {
  logDepthFragmentWGSL as l
};
