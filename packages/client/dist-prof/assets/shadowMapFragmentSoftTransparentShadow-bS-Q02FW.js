import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
const name = "shadowMapFragmentSoftTransparentShadow";
const shader = `#if SM_SOFTTRANSPARENTSHADOW==1
if ((bayerDither8(floor(((fragmentInputs.position.xy)%(8.0)))))/64.0>=uniforms.softTransparentShadowSM.x*alpha) {discard;}
#endif
`;
if (!ShaderStore.IncludesShadersStoreWGSL[name]) {
  ShaderStore.IncludesShadersStoreWGSL[name] = shader;
}
const shadowMapFragmentSoftTransparentShadowWGSL = { name, shader };
export {
  shadowMapFragmentSoftTransparentShadowWGSL
};
