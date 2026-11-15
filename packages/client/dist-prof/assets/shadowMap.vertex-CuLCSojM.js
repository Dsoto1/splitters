import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
import { b as bonesDeclaration, a as bakedVertexAnimationDeclaration, i as instancesVertex, c as bonesVertex, d as bakedVertexAnimation } from "./bakedVertexAnimation-D_Sv770W.js";
import { m as morphTargetsVertexGlobalDeclaration, a as morphTargetsVertexDeclaration, b as morphTargetsVertexGlobal, c as morphTargetsVertex } from "./morphTargetsVertex-ChAeSZCm.js";
import { helperFunctions } from "./helperFunctions-Cbwc0-4F.js";
import { s as sceneVertexDeclaration } from "./sceneVertexDeclaration-CNTvPUi6.js";
import { s as sceneUboDeclaration } from "./sceneUboDeclaration-CFURaA3t.js";
import { m as meshUboDeclaration } from "./meshUboDeclaration-DahcYBU-.js";
import { c as clipPlaneVertexDeclaration, a as clipPlaneVertex } from "./clipPlaneVertex-BdoNWmEf.js";
const name$6 = "meshVertexDeclaration";
const shader$6 = `uniform mat4 world;uniform float visibility;
`;
if (!ShaderStore.IncludesShadersStore[name$6]) {
  ShaderStore.IncludesShadersStore[name$6] = shader$6;
}
const meshVertexDeclaration = { name: name$6, shader: shader$6 };
const name$5 = "shadowMapVertexDeclaration";
const shader$5 = `#include<sceneVertexDeclaration>
#include<meshVertexDeclaration>
`;
if (!ShaderStore.IncludesShadersStore[name$5]) {
  ShaderStore.IncludesShadersStore[name$5] = shader$5;
}
const shadowMapVertexDeclaration = { name: name$5, shader: shader$5 };
const name$4 = "shadowMapUboDeclaration";
const shader$4 = `layout(std140,column_major) uniform;
#include<sceneUboDeclaration>
#include<meshUboDeclaration>
`;
if (!ShaderStore.IncludesShadersStore[name$4]) {
  ShaderStore.IncludesShadersStore[name$4] = shader$4;
}
const shadowMapUboDeclaration = { name: name$4, shader: shader$4 };
const name$3 = "shadowMapVertexExtraDeclaration";
const shader$3 = `#if SM_NORMALBIAS==1
uniform vec3 lightDataSM;
#endif
uniform vec3 biasAndScaleSM;uniform vec2 depthValuesSM;varying float vDepthMetricSM;
#if SM_USEDISTANCE==1
varying vec3 vPositionWSM;
#endif
#if defined(SM_DEPTHCLAMP) && SM_DEPTHCLAMP==1
varying float zSM;
#endif
`;
if (!ShaderStore.IncludesShadersStore[name$3]) {
  ShaderStore.IncludesShadersStore[name$3] = shader$3;
}
const shadowMapVertexExtraDeclaration = { name: name$3, shader: shader$3 };
const name$2 = "shadowMapVertexNormalBias";
const shader$2 = `#if SM_NORMALBIAS==1
#if SM_DIRECTIONINLIGHTDATA==1
vec3 worldLightDirSM=normalize(-lightDataSM.xyz);
#else
vec3 directionToLightSM=lightDataSM.xyz-worldPos.xyz;vec3 worldLightDirSM=normalize(directionToLightSM);
#endif
float ndlSM=dot(vNormalW,worldLightDirSM);float sinNLSM=sqrt(1.0-ndlSM*ndlSM);float normalBiasSM=biasAndScaleSM.y*sinNLSM;worldPos.xyz-=vNormalW*normalBiasSM;
#endif
`;
if (!ShaderStore.IncludesShadersStore[name$2]) {
  ShaderStore.IncludesShadersStore[name$2] = shader$2;
}
const shadowMapVertexNormalBias = { name: name$2, shader: shader$2 };
const name$1 = "shadowMapVertexMetric";
const shader$1 = `#if SM_USEDISTANCE==1
vPositionWSM=worldPos.xyz;
#endif
#if SM_DEPTHTEXTURE==1
#ifdef IS_NDC_HALF_ZRANGE
#define BIASFACTOR 0.5
#else
#define BIASFACTOR 1.0
#endif
#ifdef USE_REVERSE_DEPTHBUFFER
gl_Position.z-=biasAndScaleSM.x*gl_Position.w*BIASFACTOR;
#else
gl_Position.z+=biasAndScaleSM.x*gl_Position.w*BIASFACTOR;
#endif
#endif
#if defined(SM_DEPTHCLAMP) && SM_DEPTHCLAMP==1
zSM=gl_Position.z;gl_Position.z=0.0;
#elif SM_USEDISTANCE==0
#ifdef USE_REVERSE_DEPTHBUFFER
vDepthMetricSM=(-gl_Position.z+depthValuesSM.x)/depthValuesSM.y+biasAndScaleSM.x;
#else
vDepthMetricSM=(gl_Position.z+depthValuesSM.x)/depthValuesSM.y+biasAndScaleSM.x;
#endif
#endif
`;
if (!ShaderStore.IncludesShadersStore[name$1]) {
  ShaderStore.IncludesShadersStore[name$1] = shader$1;
}
const shadowMapVertexMetric = { name: name$1, shader: shader$1 };
const shadowMapVertexMetric$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  shadowMapVertexMetric
}, Symbol.toStringTag, { value: "Module" }));
const name = "shadowMapVertexShader";
const shader = `attribute vec3 position;
#ifdef NORMAL
attribute vec3 normal;
#endif
#include<bonesDeclaration>
#include<bakedVertexAnimationDeclaration>
#include<morphTargetsVertexGlobalDeclaration>
#include<morphTargetsVertexDeclaration>[0..maxSimultaneousMorphTargets]
#ifdef INSTANCES
attribute vec4 world0;attribute vec4 world1;attribute vec4 world2;attribute vec4 world3;
#endif
#include<helperFunctions>
#include<__decl__shadowMapVertex>
#ifdef ALPHATEXTURE
varying vec2 vUV;uniform mat4 diffuseMatrix;
#ifdef UV1
attribute vec2 uv;
#endif
#ifdef UV2
attribute vec2 uv2;
#endif
#endif
#include<shadowMapVertexExtraDeclaration>
#include<clipPlaneVertexDeclaration>
#define CUSTOM_VERTEX_DEFINITIONS
void main(void)
{vec3 positionUpdated=position;
#ifdef UV1
vec2 uvUpdated=uv;
#endif
#ifdef UV2
vec2 uv2Updated=uv2;
#endif
#ifdef NORMAL
vec3 normalUpdated=normal;
#endif
#include<morphTargetsVertexGlobal>
#include<morphTargetsVertex>[0..maxSimultaneousMorphTargets]
#include<instancesVertex>
#include<bonesVertex>
#include<bakedVertexAnimation>
vec4 worldPos=finalWorld*vec4(positionUpdated,1.0);
#ifdef NORMAL
mat3 normWorldSM=mat3(finalWorld);
#if defined(INSTANCES) && defined(THIN_INSTANCES)
vec3 vNormalW=normalUpdated/vec3(dot(normWorldSM[0],normWorldSM[0]),dot(normWorldSM[1],normWorldSM[1]),dot(normWorldSM[2],normWorldSM[2]));vNormalW=normalize(normWorldSM*vNormalW);
#else
#ifdef NONUNIFORMSCALING
normWorldSM=transposeMat3(inverseMat3(normWorldSM));
#endif
vec3 vNormalW=normalize(normWorldSM*normalUpdated);
#endif
#endif
#include<shadowMapVertexNormalBias>
gl_Position=viewProjection*worldPos;
#include<shadowMapVertexMetric>
#ifdef ALPHATEXTURE
#ifdef UV1
vUV=vec2(diffuseMatrix*vec4(uvUpdated,1.0,0.0));
#endif
#ifdef UV2
vUV=vec2(diffuseMatrix*vec4(uv2Updated,1.0,0.0));
#endif
#endif
#include<clipPlaneVertex>
}`;
if (!ShaderStore.ShadersStore[name]) {
  ShaderStore.ShadersStore[name] = shader;
}
const includes = [bonesDeclaration, bakedVertexAnimationDeclaration, morphTargetsVertexGlobalDeclaration, morphTargetsVertexDeclaration, helperFunctions, sceneVertexDeclaration, meshVertexDeclaration, shadowMapVertexDeclaration, sceneUboDeclaration, meshUboDeclaration, shadowMapUboDeclaration, shadowMapVertexExtraDeclaration, clipPlaneVertexDeclaration, morphTargetsVertexGlobal, morphTargetsVertex, instancesVertex, bonesVertex, bakedVertexAnimation, shadowMapVertexNormalBias, shadowMapVertexMetric, clipPlaneVertex];
for (const inc of includes) {
  if (!ShaderStore.IncludesShadersStore[inc.name]) {
    ShaderStore.IncludesShadersStore[inc.name] = inc.shader;
  }
}
const shadowMapVertexShader = { name, shader };
const shadowMap_vertex = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  shadowMapVertexShader
}, Symbol.toStringTag, { value: "Module" }));
export {
  shadowMap_vertex as a,
  meshVertexDeclaration as m,
  shadowMapVertexMetric$1 as s
};
