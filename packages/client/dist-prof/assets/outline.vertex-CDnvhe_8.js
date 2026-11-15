import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
import { b as bonesDeclarationWGSL, a as bonesVertexWGSL } from "./bonesVertex-Cpn2iSQy.js";
import { b as bakedVertexAnimationDeclarationWGSL, i as instancesVertexWGSL, a as bakedVertexAnimationWGSL } from "./instancesVertex-23t-Q1Uk.js";
import { m as morphTargetsVertexGlobalDeclarationWGSL, a as morphTargetsVertexDeclarationWGSL, b as morphTargetsVertexGlobalWGSL, c as morphTargetsVertexWGSL } from "./morphTargetsVertex-73_uAtmG.js";
import { c as clipPlaneVertexDeclarationWGSL, a as clipPlaneVertexWGSL } from "./clipPlaneVertex-CtRrEuj6.js";
import { i as instancesDeclarationWGSL } from "./instancesDeclaration-DL63iftc.js";
import { logDepthDeclarationWGSL } from "./logDepthDeclaration-Cf0EhojL.js";
import { l as logDepthVertexWGSL } from "./logDepthVertex-vt-aaTE3.js";
const name = "outlineVertexShader";
const shader = `attribute position: vec3f;attribute normal: vec3f;
#include<bonesDeclaration>
#include<bakedVertexAnimationDeclaration>
#include<morphTargetsVertexGlobalDeclaration>
#include<morphTargetsVertexDeclaration>[0..maxSimultaneousMorphTargets]
#include<clipPlaneVertexDeclaration>
uniform offset: f32;
#include<instancesDeclaration>
uniform viewProjection: mat4x4f;
#ifdef ALPHATEST
varying vUV: vec2f;uniform diffuseMatrix: mat4x4f; 
#ifdef UV1
attribute uv: vec2f;
#endif
#ifdef UV2
attribute uv2: vec2f;
#endif
#endif
#include<logDepthDeclaration>
#define CUSTOM_VERTEX_DEFINITIONS
@vertex
fn main(input: VertexInputs)->FragmentInputs {var positionUpdated: vec3f=vertexInputs.position;var normalUpdated: vec3f=vertexInputs.normal;
#ifdef UV1
var uvUpdated: vec2f=vertexInputs.uv;
#endif
#ifdef UV2
var uv2Updated: vec2f=vertexInputs.uv2;
#endif
#include<morphTargetsVertexGlobal>
#include<morphTargetsVertex>[0..maxSimultaneousMorphTargets]
var offsetPosition: vec3f=positionUpdated+(normalUpdated*uniforms.offset);
#include<instancesVertex>
#include<bonesVertex>
#include<bakedVertexAnimation>
var worldPos: vec4f=finalWorld*vec4f(offsetPosition,1.0);vertexOutputs.position=uniforms.viewProjection*worldPos;
#ifdef ALPHATEST
#ifdef UV1
vertexOutputs.vUV=(uniforms.diffuseMatrix*vec4f(uvUpdated,1.0,0.0)).xy;
#endif
#ifdef UV2
vertexOutputs.vUV=(uniforms.diffuseMatrix*vec4f(uv2Updated,1.0,0.0)).xy;
#endif
#endif
#include<clipPlaneVertex>
#include<logDepthVertex>
}
`;
if (!ShaderStore.ShadersStoreWGSL[name]) {
  ShaderStore.ShadersStoreWGSL[name] = shader;
}
const includes = [bonesDeclarationWGSL, bakedVertexAnimationDeclarationWGSL, morphTargetsVertexGlobalDeclarationWGSL, morphTargetsVertexDeclarationWGSL, clipPlaneVertexDeclarationWGSL, instancesDeclarationWGSL, logDepthDeclarationWGSL, morphTargetsVertexGlobalWGSL, morphTargetsVertexWGSL, instancesVertexWGSL, bonesVertexWGSL, bakedVertexAnimationWGSL, clipPlaneVertexWGSL, logDepthVertexWGSL];
for (const inc of includes) {
  if (!ShaderStore.IncludesShadersStoreWGSL[inc.name]) {
    ShaderStore.IncludesShadersStoreWGSL[inc.name] = inc.shader;
  }
}
const outlineVertexShaderWGSL = { name, shader };
export {
  outlineVertexShaderWGSL
};
