import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
const name = "shadowMapFragmentSoftTransparentShadow";
const shader = `#if SM_SOFTTRANSPARENTSHADOW==1
if ((bayerDither8(floor(mod(gl_FragCoord.xy,8.0))))/64.0>=softTransparentShadowSM.x*alpha) discard;
#endif
`;
if (!ShaderStore.IncludesShadersStore[name]) {
  ShaderStore.IncludesShadersStore[name] = shader;
}
const shadowMapFragmentSoftTransparentShadow = { name, shader };
export {
  shadowMapFragmentSoftTransparentShadow
};
