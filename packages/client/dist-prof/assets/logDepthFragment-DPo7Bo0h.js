import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
const name = "logDepthFragment";
const shader = `#ifdef LOGARITHMICDEPTH
gl_FragDepthEXT=log2(vFragmentDepth)*logarithmicDepthConstant*0.5;
#endif
`;
if (!ShaderStore.IncludesShadersStore[name]) {
  ShaderStore.IncludesShadersStore[name] = shader;
}
const logDepthFragment = { name, shader };
export {
  logDepthFragment as l
};
