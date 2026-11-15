import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
import { b as bonesDeclarationWGSL, a as bonesVertexWGSL } from "./bonesVertex-Cpn2iSQy.js";
import { b as bakedVertexAnimationDeclarationWGSL, i as instancesVertexWGSL, a as bakedVertexAnimationWGSL } from "./instancesVertex-23t-Q1Uk.js";
import { c as clipPlaneVertexDeclarationWGSL, a as clipPlaneVertexWGSL } from "./clipPlaneVertex-CtRrEuj6.js";
import { f as fogVertexDeclarationWGSL, a as fogVertexWGSL } from "./fogVertex-CNSnaHda.js";
import { i as instancesDeclarationWGSL } from "./instancesDeclaration-DL63iftc.js";
import { v as vertexColorMixingWGSL } from "./vertexColorMixing-CGAqvR_s.js";
const name = "colorVertexShader";
const shader = `attribute position: vec3f;
#ifdef VERTEXCOLOR
attribute color: vec4f;
#endif
#include<bonesDeclaration>
#include<bakedVertexAnimationDeclaration>
#include<clipPlaneVertexDeclaration>
#include<fogVertexDeclaration>
#ifdef FOG
uniform view: mat4x4f;
#endif
#include<instancesDeclaration>
uniform viewProjection: mat4x4f;
#if defined(VERTEXCOLOR) || defined(INSTANCESCOLOR) && defined(INSTANCES)
varying vColor: vec4f;
#endif
#define CUSTOM_VERTEX_DEFINITIONS
@vertex
fn main(input : VertexInputs)->FragmentInputs {
#define CUSTOM_VERTEX_MAIN_BEGIN
#ifdef VERTEXCOLOR
var colorUpdated: vec4f=vertexInputs.color;
#endif
#include<instancesVertex>
#include<bonesVertex>
#include<bakedVertexAnimation>
var worldPos: vec4f=finalWorld* vec4f(vertexInputs.position,1.0);vertexOutputs.position=uniforms.viewProjection*worldPos;
#include<clipPlaneVertex>
#include<fogVertex>
#include<vertexColorMixing>
#define CUSTOM_VERTEX_MAIN_END
}`;
if (!ShaderStore.ShadersStoreWGSL[name]) {
  ShaderStore.ShadersStoreWGSL[name] = shader;
}
const includes = [bonesDeclarationWGSL, bakedVertexAnimationDeclarationWGSL, clipPlaneVertexDeclarationWGSL, fogVertexDeclarationWGSL, instancesDeclarationWGSL, instancesVertexWGSL, bonesVertexWGSL, bakedVertexAnimationWGSL, clipPlaneVertexWGSL, fogVertexWGSL, vertexColorMixingWGSL];
for (const inc of includes) {
  if (!ShaderStore.IncludesShadersStoreWGSL[inc.name]) {
    ShaderStore.IncludesShadersStoreWGSL[inc.name] = inc.shader;
  }
}
const colorVertexShaderWGSL = { name, shader };
export {
  colorVertexShaderWGSL
};
