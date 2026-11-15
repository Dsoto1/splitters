import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
import { helperFunctions } from "./helperFunctions-Cbwc0-4F.js";
const name = "rgbdEncodePixelShader";
const shader = `varying vec2 vUV;uniform sampler2D textureSampler;
#include<helperFunctions>
#define CUSTOM_FRAGMENT_DEFINITIONS
void main(void) 
{gl_FragColor=toRGBD(texture2D(textureSampler,vUV).rgb);}`;
if (!ShaderStore.ShadersStore[name]) {
  ShaderStore.ShadersStore[name] = shader;
}
const includes = [helperFunctions];
for (const inc of includes) {
  if (!ShaderStore.IncludesShadersStore[inc.name]) {
    ShaderStore.IncludesShadersStore[inc.name] = inc.shader;
  }
}
const rgbdEncodePixelShader = { name, shader };
export {
  rgbdEncodePixelShader
};
