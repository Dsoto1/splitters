import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
const name$1 = "fogFragmentDeclaration";
const shader$1 = `#ifdef FOG
#define FOGMODE_NONE 0.
#define FOGMODE_EXP 1.
#define FOGMODE_EXP2 2.
#define FOGMODE_LINEAR 3.
#define E 2.71828
uniform vec4 vFogInfos;uniform vec3 vFogColor;varying vec3 vFogDistance;float CalcFogFactor()
{float fogCoeff=1.0;float fogStart=vFogInfos.y;float fogEnd=vFogInfos.z;float fogDensity=vFogInfos.w;float fogDistance=length(vFogDistance);if (FOGMODE_LINEAR==vFogInfos.x)
{fogCoeff=(fogEnd-fogDistance)/(fogEnd-fogStart);}
else if (FOGMODE_EXP==vFogInfos.x)
{fogCoeff=1.0/pow(E,fogDistance*fogDensity);}
else if (FOGMODE_EXP2==vFogInfos.x)
{fogCoeff=1.0/pow(E,fogDistance*fogDistance*fogDensity*fogDensity);}
return clamp(fogCoeff,0.0,1.0);}
#endif
`;
if (!ShaderStore.IncludesShadersStore[name$1]) {
  ShaderStore.IncludesShadersStore[name$1] = shader$1;
}
const fogFragmentDeclaration = { name: name$1, shader: shader$1 };
const fogFragmentDeclaration$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  fogFragmentDeclaration
}, Symbol.toStringTag, { value: "Module" }));
const name = "fogFragment";
const shader = `#ifdef FOG
float fog=CalcFogFactor();
#ifdef PBR
fog=toLinearSpace(fog);
#endif
color.rgb=mix(vFogColor,color.rgb,fog);
#endif
`;
if (!ShaderStore.IncludesShadersStore[name]) {
  ShaderStore.IncludesShadersStore[name] = shader;
}
const fogFragment = { name, shader };
export {
  fogFragment as a,
  fogFragmentDeclaration$1 as b,
  fogFragmentDeclaration as f
};
