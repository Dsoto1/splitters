import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
const name = "fresnelFunction";
const shader = `#ifdef FRESNEL
fn computeFresnelTerm(viewDirection: vec3f,worldNormal: vec3f,bias: f32,power: f32)->f32
{let fresnelTerm: f32=pow(bias+abs(dot(viewDirection,worldNormal)),power);return clamp(fresnelTerm,0.,1.);}
#endif
`;
if (!ShaderStore.IncludesShadersStoreWGSL[name]) {
  ShaderStore.IncludesShadersStoreWGSL[name] = shader;
}
const fresnelFunctionWGSL = { name, shader };
export {
  fresnelFunctionWGSL
};
