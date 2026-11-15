import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
import { s as sceneUboDeclaration } from "./sceneUboDeclaration-CFURaA3t.js";
import { m as meshUboDeclaration } from "./meshUboDeclaration-DahcYBU-.js";
import { i as instancesDeclaration } from "./instancesDeclaration-CoQOC7Vy.js";
import { c as clipPlaneVertexDeclaration, a as clipPlaneVertex } from "./clipPlaneVertex-BdoNWmEf.js";
import { logDepthDeclaration } from "./logDepthDeclaration-CQzyhobd.js";
import { i as instancesVertex } from "./bakedVertexAnimation-D_Sv770W.js";
import { l as logDepthVertex } from "./logDepthVertex-IJzM9PkV.js";
const name$2 = "lineVertexDeclaration";
const shader$2 = `uniform mat4 viewProjection;
#define ADDITIONAL_VERTEX_DECLARATION
`;
if (!ShaderStore.IncludesShadersStore[name$2]) {
  ShaderStore.IncludesShadersStore[name$2] = shader$2;
}
const lineVertexDeclaration = { name: name$2, shader: shader$2 };
const name$1 = "lineUboDeclaration";
const shader$1 = `layout(std140,column_major) uniform;
#include<sceneUboDeclaration>
#include<meshUboDeclaration>
`;
if (!ShaderStore.IncludesShadersStore[name$1]) {
  ShaderStore.IncludesShadersStore[name$1] = shader$1;
}
const lineUboDeclaration = { name: name$1, shader: shader$1 };
const name = "lineVertexShader";
const shader = `#include<__decl__lineVertex>
#include<instancesDeclaration>
#include<clipPlaneVertexDeclaration>
attribute vec3 position;attribute vec4 normal;uniform float width;uniform float aspectRatio;
#include<logDepthDeclaration>
#define CUSTOM_VERTEX_DEFINITIONS
void main(void) {
#define CUSTOM_VERTEX_MAIN_BEGIN
#include<instancesVertex>
mat4 worldViewProjection=viewProjection*finalWorld;vec4 viewPosition=worldViewProjection*vec4(position,1.0);vec4 viewPositionNext=worldViewProjection*vec4(normal.xyz,1.0);vec2 currentScreen=viewPosition.xy/viewPosition.w;vec2 nextScreen=viewPositionNext.xy/viewPositionNext.w;currentScreen.x*=aspectRatio;nextScreen.x*=aspectRatio;vec2 dir=normalize(nextScreen-currentScreen);vec2 normalDir=vec2(-dir.y,dir.x);normalDir*=width/2.0;normalDir.x/=aspectRatio;vec4 offset=vec4(normalDir*normal.w,0.0,0.0);gl_Position=viewPosition+offset;
#if defined(CLIPPLANE) || defined(CLIPPLANE2) || defined(CLIPPLANE3) || defined(CLIPPLANE4) || defined(CLIPPLANE5) || defined(CLIPPLANE6)
vec4 worldPos=finalWorld*vec4(position,1.0);
#include<clipPlaneVertex>
#endif
#include<logDepthVertex>
#define CUSTOM_VERTEX_MAIN_END
}`;
if (!ShaderStore.ShadersStore[name]) {
  ShaderStore.ShadersStore[name] = shader;
}
const includes = [lineVertexDeclaration, sceneUboDeclaration, meshUboDeclaration, lineUboDeclaration, instancesDeclaration, clipPlaneVertexDeclaration, logDepthDeclaration, instancesVertex, clipPlaneVertex, logDepthVertex];
for (const inc of includes) {
  if (!ShaderStore.IncludesShadersStore[inc.name]) {
    ShaderStore.IncludesShadersStore[inc.name] = inc.shader;
  }
}
const lineVertexShader = { name, shader };
export {
  lineVertexShader
};
