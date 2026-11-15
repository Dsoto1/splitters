import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
import { i as instancesDeclarationWGSL } from "./instancesDeclaration-DL63iftc.js";
import { c as clipPlaneVertexDeclarationWGSL, a as clipPlaneVertexWGSL } from "./clipPlaneVertex-CtRrEuj6.js";
import { s as sceneUboDeclarationWGSL } from "./sceneUboDeclaration-CzhdE5li.js";
import { m as meshUboDeclarationWGSL } from "./meshUboDeclaration-w24jovMr.js";
import { logDepthDeclarationWGSL } from "./logDepthDeclaration-Cf0EhojL.js";
import { i as instancesVertexWGSL } from "./instancesVertex-23t-Q1Uk.js";
import { l as logDepthVertexWGSL } from "./logDepthVertex-vt-aaTE3.js";
const name = "lineVertexShader";
const shader = `#define ADDITIONAL_VERTEX_DECLARATION
#include<instancesDeclaration>
#include<clipPlaneVertexDeclaration>
#include<sceneUboDeclaration>
#include<meshUboDeclaration>
attribute position: vec3f;attribute normal: vec4f;uniform width: f32;uniform aspectRatio: f32;
#include<logDepthDeclaration>
#define CUSTOM_VERTEX_DEFINITIONS
@vertex
fn main(input : VertexInputs)->FragmentInputs {
#define CUSTOM_VERTEX_MAIN_BEGIN
#include<instancesVertex>
var worldViewProjection: mat4x4f=scene.viewProjection*finalWorld;var viewPosition: vec4f=worldViewProjection* vec4f(vertexInputs.position,1.0);var viewPositionNext: vec4f=worldViewProjection* vec4f(vertexInputs.normal.xyz,1.0);var currentScreen: vec2f=viewPosition.xy/viewPosition.w;var nextScreen: vec2f=viewPositionNext.xy/viewPositionNext.w;currentScreen=vec2f(currentScreen.x*uniforms.aspectRatio,currentScreen.y);nextScreen=vec2f(nextScreen.x*uniforms.aspectRatio,nextScreen.y);var dir: vec2f=normalize(nextScreen-currentScreen);var normalDir: vec2f= vec2f(-dir.y,dir.x);normalDir*=uniforms.width/2.0;normalDir=vec2f(normalDir.x/uniforms.aspectRatio,normalDir.y);var offset: vec4f= vec4f(normalDir*vertexInputs.normal.w,0.0,0.0);vertexOutputs.position=viewPosition+offset;
#if defined(CLIPPLANE) || defined(CLIPPLANE2) || defined(CLIPPLANE3) || defined(CLIPPLANE4) || defined(CLIPPLANE5) || defined(CLIPPLANE6)
var worldPos: vec4f=finalWorld*vec4f(vertexInputs.position,1.0);
#include<clipPlaneVertex>
#endif
#include<logDepthVertex>
#define CUSTOM_VERTEX_MAIN_END
}`;
if (!ShaderStore.ShadersStoreWGSL[name]) {
  ShaderStore.ShadersStoreWGSL[name] = shader;
}
const includes = [instancesDeclarationWGSL, clipPlaneVertexDeclarationWGSL, sceneUboDeclarationWGSL, meshUboDeclarationWGSL, logDepthDeclarationWGSL, instancesVertexWGSL, clipPlaneVertexWGSL, logDepthVertexWGSL];
for (const inc of includes) {
  if (!ShaderStore.IncludesShadersStoreWGSL[inc.name]) {
    ShaderStore.IncludesShadersStoreWGSL[inc.name] = inc.shader;
  }
}
const lineVertexShaderWGSL = { name, shader };
export {
  lineVertexShaderWGSL
};
