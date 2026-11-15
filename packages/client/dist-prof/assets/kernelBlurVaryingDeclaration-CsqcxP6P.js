import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
const name = "kernelBlurVaryingDeclaration";
const shader = `varying sampleCoord{X}: vec2f;`;
if (!ShaderStore.IncludesShadersStoreWGSL[name]) {
  ShaderStore.IncludesShadersStoreWGSL[name] = shader;
}
const kernelBlurVaryingDeclarationWGSL = { name, shader };
export {
  kernelBlurVaryingDeclarationWGSL as k
};
