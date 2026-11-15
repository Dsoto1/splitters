import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
import { packingFunctions } from "./packingFunctions-BMJqx468.js";
import { c as clipPlaneFragmentDeclaration, a as clipPlaneFragment } from "./clipPlaneFragment-D8NTl-r6.js";
const name$3 = "bayerDitherFunctions";
const shader$3 = `float bayerDither2(vec2 _P) {return mod(2.0*_P.y+_P.x+1.0,4.0);}
float bayerDither4(vec2 _P) {vec2 P1=mod(_P,2.0); 
vec2 P2=floor(0.5*mod(_P,4.0)); 
return 4.0*bayerDither2(P1)+bayerDither2(P2);}
float bayerDither8(vec2 _P) {vec2 P1=mod(_P,2.0); 
vec2 P2=floor(0.5 *mod(_P,4.0)); 
vec2 P4=floor(0.25*mod(_P,8.0)); 
return 4.0*(4.0*bayerDither2(P1)+bayerDither2(P2))+bayerDither2(P4);}
`;
if (!ShaderStore.IncludesShadersStore[name$3]) {
  ShaderStore.IncludesShadersStore[name$3] = shader$3;
}
const bayerDitherFunctions = { name: name$3, shader: shader$3 };
const name$2 = "shadowMapFragmentExtraDeclaration";
const shader$2 = `#if SM_FLOAT==0
#include<packingFunctions>
#endif
#if SM_SOFTTRANSPARENTSHADOW==1
#include<bayerDitherFunctions>
uniform vec2 softTransparentShadowSM;
#endif
varying float vDepthMetricSM;
#if SM_USEDISTANCE==1
uniform vec3 lightDataSM;varying vec3 vPositionWSM;
#endif
uniform vec3 biasAndScaleSM;uniform vec2 depthValuesSM;
#if defined(SM_DEPTHCLAMP) && SM_DEPTHCLAMP==1
varying float zSM;
#endif
`;
if (!ShaderStore.IncludesShadersStore[name$2]) {
  ShaderStore.IncludesShadersStore[name$2] = shader$2;
}
const shadowMapFragmentExtraDeclaration = { name: name$2, shader: shader$2 };
const name$1 = "shadowMapFragment";
const shader$1 = `float depthSM=vDepthMetricSM;
#if defined(SM_DEPTHCLAMP) && SM_DEPTHCLAMP==1
#if SM_USEDISTANCE==1
depthSM=(length(vPositionWSM-lightDataSM)+depthValuesSM.x)/depthValuesSM.y+biasAndScaleSM.x;
#else
#ifdef USE_REVERSE_DEPTHBUFFER
depthSM=(-zSM+depthValuesSM.x)/depthValuesSM.y+biasAndScaleSM.x;
#else
depthSM=(zSM+depthValuesSM.x)/depthValuesSM.y+biasAndScaleSM.x;
#endif
#endif
depthSM=clamp(depthSM,0.0,1.0);
#ifdef USE_REVERSE_DEPTHBUFFER
gl_FragDepth=clamp(1.0-depthSM,0.0,1.0);
#else
gl_FragDepth=clamp(depthSM,0.0,1.0); 
#endif
#elif SM_USEDISTANCE==1
depthSM=(length(vPositionWSM-lightDataSM)+depthValuesSM.x)/depthValuesSM.y+biasAndScaleSM.x;
#endif
#if SM_ESM==1
depthSM=clamp(exp(-min(87.,biasAndScaleSM.z*depthSM)),0.,1.);
#endif
#if SM_FLOAT==1
gl_FragColor=vec4(depthSM,1.0,1.0,1.0);
#else
gl_FragColor=pack(depthSM);
#endif
return;`;
if (!ShaderStore.IncludesShadersStore[name$1]) {
  ShaderStore.IncludesShadersStore[name$1] = shader$1;
}
const shadowMapFragment = { name: name$1, shader: shader$1 };
const shadowMapFragment$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  shadowMapFragment
}, Symbol.toStringTag, { value: "Module" }));
const name = "shadowMapPixelShader";
const shader = `#include<shadowMapFragmentExtraDeclaration>
#ifdef ALPHATEXTURE
varying vec2 vUV;uniform sampler2D diffuseSampler;
#endif
#include<clipPlaneFragmentDeclaration>
#define CUSTOM_FRAGMENT_DEFINITIONS
void main(void)
{
#include<clipPlaneFragment>
#ifdef ALPHATEXTURE
vec4 opacityMap=texture2D(diffuseSampler,vUV);float alphaFromAlphaTexture=opacityMap.a;
#if SM_SOFTTRANSPARENTSHADOW==1
if (softTransparentShadowSM.y==1.0) {opacityMap.rgb=opacityMap.rgb*vec3(0.3,0.59,0.11);alphaFromAlphaTexture=opacityMap.x+opacityMap.y+opacityMap.z;}
#endif
#ifdef ALPHATESTVALUE
if (alphaFromAlphaTexture<ALPHATESTVALUE)
discard;
#endif
#endif
#if SM_SOFTTRANSPARENTSHADOW==1
#ifdef ALPHATEXTURE
if ((bayerDither8(floor(mod(gl_FragCoord.xy,8.0))))/64.0>=softTransparentShadowSM.x*alphaFromAlphaTexture) discard;
#else
if ((bayerDither8(floor(mod(gl_FragCoord.xy,8.0))))/64.0>=softTransparentShadowSM.x) discard;
#endif
#endif
#include<shadowMapFragment>
}`;
if (!ShaderStore.ShadersStore[name]) {
  ShaderStore.ShadersStore[name] = shader;
}
const includes = [packingFunctions, bayerDitherFunctions, shadowMapFragmentExtraDeclaration, clipPlaneFragmentDeclaration, clipPlaneFragment, shadowMapFragment];
for (const inc of includes) {
  if (!ShaderStore.IncludesShadersStore[inc.name]) {
    ShaderStore.IncludesShadersStore[inc.name] = inc.shader;
  }
}
const shadowMapPixelShader = { name, shader };
const shadowMap_fragment = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  shadowMapPixelShader
}, Symbol.toStringTag, { value: "Module" }));
export {
  shadowMap_fragment as a,
  shadowMapFragment$1 as s
};
