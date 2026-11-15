import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
import { c as clipPlaneFragmentDeclarationWGSL, a as clipPlaneFragmentWGSL } from "./clipPlaneFragment-BbExy4ec.js";
import { logDepthDeclarationWGSL } from "./logDepthDeclaration-Cf0EhojL.js";
import { l as logDepthFragmentWGSL } from "./logDepthFragment-81Y6Jflh.js";
const name = "outlinePixelShader";
const shader = `uniform color: vec4f;
#ifdef ALPHATEST
varying vUV: vec2f;var diffuseSamplerSampler: sampler;var diffuseSampler: texture_2d<f32>;
#endif
#include<clipPlaneFragmentDeclaration>
#include<logDepthDeclaration>
#define CUSTOM_FRAGMENT_DEFINITIONS
@fragment
fn main(input: FragmentInputs)->FragmentOutputs {
#define CUSTOM_FRAGMENT_MAIN_BEGIN
#include<clipPlaneFragment>
#ifdef ALPHATEST
if (textureSample(diffuseSampler,diffuseSamplerSampler,fragmentInputs.vUV).a<0.4) {discard;}
#endif
#include<logDepthFragment>
fragmentOutputs.color=uniforms.color;
#define CUSTOM_FRAGMENT_MAIN_END
}`;
if (!ShaderStore.ShadersStoreWGSL[name]) {
  ShaderStore.ShadersStoreWGSL[name] = shader;
}
const includes = [clipPlaneFragmentDeclarationWGSL, logDepthDeclarationWGSL, clipPlaneFragmentWGSL, logDepthFragmentWGSL];
for (const inc of includes) {
  if (!ShaderStore.IncludesShadersStoreWGSL[inc.name]) {
    ShaderStore.IncludesShadersStoreWGSL[inc.name] = inc.shader;
  }
}
const outlinePixelShaderWGSL = { name, shader };
export {
  outlinePixelShaderWGSL
};
