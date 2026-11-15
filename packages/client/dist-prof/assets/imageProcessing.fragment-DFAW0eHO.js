import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
import { i as imageProcessingDeclaration, a as imageProcessingFunctions } from "./imageProcessingFunctions-16KHFFYj.js";
import { helperFunctions } from "./helperFunctions-Cbwc0-4F.js";
const name = "imageProcessingPixelShader";
const shader = `varying vec2 vUV;uniform sampler2D textureSampler;
#include<imageProcessingDeclaration>
#include<helperFunctions>
#include<imageProcessingFunctions>
#define CUSTOM_FRAGMENT_DEFINITIONS
void main(void)
{vec4 result=texture2D(textureSampler,vUV);result.rgb=max(result.rgb,vec3(0.));
#ifdef IMAGEPROCESSING
#ifndef FROMLINEARSPACE
result.rgb=toLinearSpace(result.rgb);
#endif
result=applyImageProcessing(result);
#else
#ifdef FROMLINEARSPACE
result=applyImageProcessing(result);
#endif
#endif
gl_FragColor=result;}`;
if (!ShaderStore.ShadersStore[name]) {
  ShaderStore.ShadersStore[name] = shader;
}
const includes = [imageProcessingDeclaration, helperFunctions, imageProcessingFunctions];
for (const inc of includes) {
  if (!ShaderStore.IncludesShadersStore[inc.name]) {
    ShaderStore.IncludesShadersStore[inc.name] = inc.shader;
  }
}
const imageProcessingPixelShader = { name, shader };
export {
  imageProcessingPixelShader
};
