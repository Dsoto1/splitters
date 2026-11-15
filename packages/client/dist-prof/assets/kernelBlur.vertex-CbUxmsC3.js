import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
import { k as kernelBlurVaryingDeclarationWGSL } from "./kernelBlurVaryingDeclaration-CsqcxP6P.js";
const name$1 = "kernelBlurVertex";
const shader$1 = `vertexOutputs.sampleCoord{X}=vertexOutputs.sampleCenter+uniforms.delta*KERNEL_OFFSET{X};`;
if (!ShaderStore.IncludesShadersStoreWGSL[name$1]) {
  ShaderStore.IncludesShadersStoreWGSL[name$1] = shader$1;
}
const kernelBlurVertexWGSL = { name: name$1, shader: shader$1 };
const name = "kernelBlurVertexShader";
const shader = `attribute position: vec2f;uniform delta: vec2f;varying sampleCenter: vec2f;
#include<kernelBlurVaryingDeclaration>[0..varyingCount]
#define CUSTOM_VERTEX_DEFINITIONS
@vertex
fn main(input : VertexInputs)->FragmentInputs {const madd: vec2f= vec2f(0.5,0.5);
#define CUSTOM_VERTEX_MAIN_BEGIN
vertexOutputs.sampleCenter=(vertexInputs.position*madd+madd);
#include<kernelBlurVertex>[0..varyingCount]
vertexOutputs.position= vec4f(vertexInputs.position,0.0,1.0);
#define CUSTOM_VERTEX_MAIN_END
}`;
if (!ShaderStore.ShadersStoreWGSL[name]) {
  ShaderStore.ShadersStoreWGSL[name] = shader;
}
const includes = [kernelBlurVaryingDeclarationWGSL, kernelBlurVertexWGSL];
for (const inc of includes) {
  if (!ShaderStore.IncludesShadersStoreWGSL[inc.name]) {
    ShaderStore.IncludesShadersStoreWGSL[inc.name] = inc.shader;
  }
}
const kernelBlurVertexShaderWGSL = { name, shader };
export {
  kernelBlurVertexShaderWGSL
};
