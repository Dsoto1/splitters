import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
import { k as kernelBlurVaryingDeclaration } from "./kernelBlurVaryingDeclaration-oKLbhvFM.js";
const name$1 = "kernelBlurVertex";
const shader$1 = `sampleCoord{X}=sampleCenter+delta*KERNEL_OFFSET{X};`;
if (!ShaderStore.IncludesShadersStore[name$1]) {
  ShaderStore.IncludesShadersStore[name$1] = shader$1;
}
const kernelBlurVertex = { name: name$1, shader: shader$1 };
const name = "kernelBlurVertexShader";
const shader = `attribute vec2 position;uniform vec2 delta;varying vec2 sampleCenter;
#include<kernelBlurVaryingDeclaration>[0..varyingCount]
const vec2 madd=vec2(0.5,0.5);
#define CUSTOM_VERTEX_DEFINITIONS
void main(void) {
#define CUSTOM_VERTEX_MAIN_BEGIN
sampleCenter=(position*madd+madd);
#include<kernelBlurVertex>[0..varyingCount]
gl_Position=vec4(position,0.0,1.0);
#define CUSTOM_VERTEX_MAIN_END
}`;
if (!ShaderStore.ShadersStore[name]) {
  ShaderStore.ShadersStore[name] = shader;
}
const includes = [kernelBlurVaryingDeclaration, kernelBlurVertex];
for (const inc of includes) {
  if (!ShaderStore.IncludesShadersStore[inc.name]) {
    ShaderStore.IncludesShadersStore[inc.name] = inc.shader;
  }
}
const kernelBlurVertexShader = { name, shader };
export {
  kernelBlurVertexShader
};
