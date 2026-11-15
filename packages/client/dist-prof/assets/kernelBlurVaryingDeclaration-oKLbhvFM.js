import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
const name = "kernelBlurVaryingDeclaration";
const shader = `varying vec2 sampleCoord{X};`;
if (!ShaderStore.IncludesShadersStore[name]) {
  ShaderStore.IncludesShadersStore[name] = shader;
}
const kernelBlurVaryingDeclaration = { name, shader };
export {
  kernelBlurVaryingDeclaration as k
};
