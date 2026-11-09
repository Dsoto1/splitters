import{K as e}from"./babylon-89dYjaND.js";import{helperFunctionsWGSL as o}from"./helperFunctions-CmW-SUmM.js";const t="extractHighlightsPixelShader",a=`#include<helperFunctions>
varying vUV: vec2f;var textureSamplerSampler: sampler;var textureSampler: texture_2d<f32>;uniform threshold: f32;uniform exposure: f32;
#define CUSTOM_FRAGMENT_DEFINITIONS
@fragment
fn main(input: FragmentInputs)->FragmentOutputs {fragmentOutputs.color=textureSample(textureSampler,textureSamplerSampler,input.vUV);var luma: f32=dot(LuminanceEncodeApprox,fragmentOutputs.color.rgb*uniforms.exposure);fragmentOutputs.color=vec4f(step(uniforms.threshold,luma)*fragmentOutputs.color.rgb,fragmentOutputs.color.a);}`;e.ShadersStoreWGSL[t]||(e.ShadersStoreWGSL[t]=a);const n=[o];for(const r of n)e.IncludesShadersStoreWGSL[r.name]||(e.IncludesShadersStoreWGSL[r.name]=r.shader);const m={name:t,shader:a};export{m as extractHighlightsPixelShaderWGSL};
