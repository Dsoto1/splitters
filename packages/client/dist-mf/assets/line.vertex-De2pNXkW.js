import{K as e}from"./babylon-89dYjaND.js";import{s as l}from"./sceneUboDeclaration-DIVgotUo.js";import{m as s}from"./meshUboDeclaration-BvSCfH30.js";import{i as d}from"./instancesDeclaration-T99_geWh.js";import{c as m,a as f}from"./clipPlaneVertex-CC-XN0sz.js";import{logDepthDeclaration as P}from"./logDepthDeclaration-HFiP813h.js";import{i as S}from"./bakedVertexAnimation-B93q2Y_I.js";import{l as u}from"./logDepthVertex-IACsfxpr.js";const o="lineVertexDeclaration",t=`uniform mat4 viewProjection;
#define ADDITIONAL_VERTEX_DECLARATION
`;e.IncludesShadersStore[o]||(e.IncludesShadersStore[o]=t);const x={name:o,shader:t},n="lineUboDeclaration",a=`layout(std140,column_major) uniform;
#include<sceneUboDeclaration>
#include<meshUboDeclaration>
`;e.IncludesShadersStore[n]||(e.IncludesShadersStore[n]=a);const D={name:n,shader:a},r="lineVertexShader",c=`#include<__decl__lineVertex>
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
}`;e.ShadersStore[r]||(e.ShadersStore[r]=c);const v=[x,l,s,D,d,m,P,S,f,u];for(const i of v)e.IncludesShadersStore[i.name]||(e.IncludesShadersStore[i.name]=i.shader);const L={name:r,shader:c};export{L as lineVertexShader};
