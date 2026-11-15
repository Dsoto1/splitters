import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
import { objectIdFunctionsWGSL } from "./objectIdFunctions-CSQgrKyq.js";
import { p as prePassDeclarationWGSL, m as meshBlendTagFragmentOutputWGSL } from "./meshBlendTagFragmentOutput-BcEf-EkO.js";
import { c as clipPlaneFragmentDeclarationWGSL, a as clipPlaneFragmentWGSL } from "./clipPlaneFragment-BbExy4ec.js";
import { i as imageProcessingDeclarationWGSL, a as imageProcessingFunctionsWGSL } from "./imageProcessingFunctions-BJDZDhUW.js";
import { logDepthDeclarationWGSL } from "./logDepthDeclaration-Cf0EhojL.js";
import { helperFunctionsWGSL } from "./helperFunctions-vFx73x84.js";
import { f as fogFragmentDeclarationWGSL, a as fogFragmentWGSL } from "./fogFragment-Dm1Vlk0e.js";
import { l as logDepthFragmentWGSL } from "./logDepthFragment-81Y6Jflh.js";
import { a as geometryRenderingFragmentWGSL } from "./geometryRenderingFragment-DR3MRJz3.js";
const name = "gpuRenderParticlesPixelShader";
const shader = `var diffuseSamplerSampler: sampler;var diffuseSampler: texture_2d<f32>;varying vUV: vec2f;varying vColor: vec4f;
#ifdef PREPASS
uniform geometryZeroAlphaDiscard: f32;
#ifdef PREPASS_POSITION
varying vGeometryPositionW: vec3f;
#endif
#ifdef PREPASS_WORLD_NORMAL
varying vGeometryNormalW: vec3f;
#endif
#ifdef PREPASS_NORMAL
varying vGeometryNormalV: vec3f;
#endif
#endif
#define PREPASS_VELOCITY_ZERO
#include<prePassDeclaration>[SCENE_MRT_COUNT]
#include<clipPlaneFragmentDeclaration>
#include<imageProcessingDeclaration>
#include<logDepthDeclaration>
#include<helperFunctions>
#include<imageProcessingFunctions>
#include<fogFragmentDeclaration>
@fragment
fn main(input: FragmentInputs)->FragmentOutputs {
#include<clipPlaneFragment>
let textureColor: vec4f=textureSample(diffuseSampler,diffuseSamplerSampler,input.vUV);var baseColor: vec4f=textureColor*input.vColor;
#ifdef PREPASS
let geometryAlbedo: vec3f=toLinearSpaceVec3(baseColor.rgb);
#endif
#ifdef BLENDMULTIPLYMODE
let alpha: f32=input.vColor.a*textureColor.a;baseColor=vec4f(baseColor.rgb*alpha+vec3f(1.0)*(1.0-alpha),baseColor.a);
#endif
#include<logDepthFragment>
#include<fogFragment>(color,baseColor)
#ifdef IMAGEPROCESSINGPOSTPROCESS
baseColor=vec4f(toLinearSpaceVec3(baseColor.rgb),baseColor.a);
#else
#ifdef IMAGEPROCESSING
baseColor=vec4f(toLinearSpaceVec3(baseColor.rgb),baseColor.a);baseColor=applyImageProcessing(baseColor);
#endif
#endif
#ifdef PREPASS
let geometryColor: vec4f=baseColor;if (geometryColor.a<=0.0 && uniforms.geometryZeroAlphaDiscard>0.0) {discard;}
#ifdef PREPASS_POSITION
let geometryPositionW: vec3f=input.vGeometryPositionW;
#endif
#ifdef PREPASS_LOCAL_POSITION
let geometryPositionL: vec3f=input.vPosition;
#endif
#ifdef PREPASS_DEPTH
let geometryViewDepth: f32=input.vViewPos.z;
#endif
#ifdef PREPASS_NORMALIZED_VIEW_DEPTH
let geometryNormalizedViewDepth: f32=input.vNormViewDepth;
#endif
#ifdef PREPASS_NORMAL
let geometryNormalV: vec3f=normalize(input.vGeometryNormalV);
#endif
#ifdef PREPASS_WORLD_NORMAL
let geometryNormalW: vec3f=normalize(input.vGeometryNormalW);
#endif
#include<geometryRenderingFragment>
#else
fragmentOutputs.color=baseColor;
#endif
}
`;
if (!ShaderStore.ShadersStoreWGSL[name]) {
  ShaderStore.ShadersStoreWGSL[name] = shader;
}
const includes = [objectIdFunctionsWGSL, prePassDeclarationWGSL, clipPlaneFragmentDeclarationWGSL, imageProcessingDeclarationWGSL, logDepthDeclarationWGSL, helperFunctionsWGSL, imageProcessingFunctionsWGSL, fogFragmentDeclarationWGSL, clipPlaneFragmentWGSL, logDepthFragmentWGSL, fogFragmentWGSL, meshBlendTagFragmentOutputWGSL, geometryRenderingFragmentWGSL];
for (const inc of includes) {
  if (!ShaderStore.IncludesShadersStoreWGSL[inc.name]) {
    ShaderStore.IncludesShadersStoreWGSL[inc.name] = inc.shader;
  }
}
const gpuRenderParticlesPixelShaderWGSL = { name, shader };
export {
  gpuRenderParticlesPixelShaderWGSL
};
