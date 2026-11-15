import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
const name = "mainUVVaryingDeclaration";
const shader = `#ifdef MAINUV{X}
varying vec2 vMainUV{X};
#endif
`;
if (!ShaderStore.IncludesShadersStore[name]) {
  ShaderStore.IncludesShadersStore[name] = shader;
}
const mainUVVaryingDeclaration = { name, shader };
export {
  mainUVVaryingDeclaration as m
};
