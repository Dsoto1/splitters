import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
const name = "logDepthVertex";
const shader = `#ifdef LOGARITHMICDEPTH
vFragmentDepth=1.0+gl_Position.w;gl_Position.z=log2(max(0.000001,vFragmentDepth))*logarithmicDepthConstant;
#endif
`;
if (!ShaderStore.IncludesShadersStore[name]) {
  ShaderStore.IncludesShadersStore[name] = shader;
}
const logDepthVertex = { name, shader };
export {
  logDepthVertex as l
};
