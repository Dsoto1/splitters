import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
import { k as kernelBlurVaryingDeclaration } from "./kernelBlurVaryingDeclaration-oKLbhvFM.js";
import { packingFunctions } from "./packingFunctions-BMJqx468.js";
const name$2 = "kernelBlurFragment";
const shader$2 = `#ifdef DOF
factor=sampleCoC(sampleCoord{X}); 
computedWeight=KERNEL_WEIGHT{X}*factor;sumOfWeights+=computedWeight;
#else
computedWeight=KERNEL_WEIGHT{X};
#endif
#ifdef PACKEDFLOAT
blend+=unpack(texture2D(textureSampler,sampleCoord{X}))*computedWeight;
#else
blend+=texture2D(textureSampler,sampleCoord{X})*computedWeight;
#endif
`;
if (!ShaderStore.IncludesShadersStore[name$2]) {
  ShaderStore.IncludesShadersStore[name$2] = shader$2;
}
const kernelBlurFragment = { name: name$2, shader: shader$2 };
const name$1 = "kernelBlurFragment2";
const shader$1 = `#ifdef DOF
factor=sampleCoC(sampleCenter+delta*KERNEL_DEP_OFFSET{X});computedWeight=KERNEL_DEP_WEIGHT{X}*factor;sumOfWeights+=computedWeight;
#else
computedWeight=KERNEL_DEP_WEIGHT{X};
#endif
#ifdef PACKEDFLOAT
blend+=unpack(texture2D(textureSampler,sampleCenter+delta*KERNEL_DEP_OFFSET{X}))*computedWeight;
#else
blend+=texture2D(textureSampler,sampleCenter+delta*KERNEL_DEP_OFFSET{X})*computedWeight;
#endif
`;
if (!ShaderStore.IncludesShadersStore[name$1]) {
  ShaderStore.IncludesShadersStore[name$1] = shader$1;
}
const kernelBlurFragment2 = { name: name$1, shader: shader$1 };
const name = "kernelBlurPixelShader";
const shader = `uniform sampler2D textureSampler;uniform vec2 delta;varying vec2 sampleCenter;
#ifdef DOF
uniform sampler2D circleOfConfusionSampler;float sampleCoC(in vec2 offset) {float coc=texture2D(circleOfConfusionSampler,offset).r;return coc; }
#endif
#include<kernelBlurVaryingDeclaration>[0..varyingCount]
#ifdef PACKEDFLOAT
#include<packingFunctions>
#endif
#define CUSTOM_FRAGMENT_DEFINITIONS
void main(void)
{float computedWeight=0.0;
#ifdef PACKEDFLOAT
float blend=0.;
#else
vec4 blend=vec4(0.);
#endif
#ifdef DOF
float sumOfWeights=CENTER_WEIGHT; 
float factor=0.0;
#ifdef PACKEDFLOAT
blend+=unpack(texture2D(textureSampler,sampleCenter))*CENTER_WEIGHT;
#else
blend+=texture2D(textureSampler,sampleCenter)*CENTER_WEIGHT;
#endif
#endif
#include<kernelBlurFragment>[0..varyingCount]
#include<kernelBlurFragment2>[0..depCount]
#ifdef PACKEDFLOAT
gl_FragColor=pack(blend);
#else
gl_FragColor=blend;
#endif
#ifdef DOF
gl_FragColor/=sumOfWeights;
#endif
}`;
if (!ShaderStore.ShadersStore[name]) {
  ShaderStore.ShadersStore[name] = shader;
}
const includes = [kernelBlurVaryingDeclaration, packingFunctions, kernelBlurFragment, kernelBlurFragment2];
for (const inc of includes) {
  if (!ShaderStore.IncludesShadersStore[inc.name]) {
    ShaderStore.IncludesShadersStore[inc.name] = inc.shader;
  }
}
const kernelBlurPixelShader = { name, shader };
export {
  kernelBlurPixelShader
};
