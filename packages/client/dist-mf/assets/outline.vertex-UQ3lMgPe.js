import{K as e}from"./babylon-89dYjaND.js";import{b as o,a as r,i as n,c as d,d as s}from"./bakedVertexAnimation-B93q2Y_I.js";import{m as c,a as l,b as f,c as m}from"./morphTargetsVertex-BSsIJc8Z.js";import{c as u,a as p}from"./clipPlaneVertex-CC-XN0sz.js";import{i as V}from"./instancesDeclaration-T99_geWh.js";import{logDepthDeclaration as v}from"./logDepthDeclaration-HFiP813h.js";import{l as x}from"./logDepthVertex-IACsfxpr.js";const a="outlineVertexShader",i=`attribute vec3 position;attribute vec3 normal;
#include<bonesDeclaration>
#include<bakedVertexAnimationDeclaration>
#include<morphTargetsVertexGlobalDeclaration>
#include<morphTargetsVertexDeclaration>[0..maxSimultaneousMorphTargets]
#include<clipPlaneVertexDeclaration>
uniform float offset;
#include<instancesDeclaration>
uniform mat4 viewProjection;
#ifdef ALPHATEST
varying vec2 vUV;uniform mat4 diffuseMatrix;
#ifdef UV1
attribute vec2 uv;
#endif
#ifdef UV2
attribute vec2 uv2;
#endif
#endif
#include<logDepthDeclaration>
#define CUSTOM_VERTEX_DEFINITIONS
void main(void)
{vec3 positionUpdated=position;vec3 normalUpdated=normal;
#ifdef UV1
vec2 uvUpdated=uv;
#endif
#ifdef UV2
vec2 uv2Updated=uv2;
#endif
#include<morphTargetsVertexGlobal>
#include<morphTargetsVertex>[0..maxSimultaneousMorphTargets]
vec3 offsetPosition=positionUpdated+(normalUpdated*offset);
#include<instancesVertex>
#include<bonesVertex>
#include<bakedVertexAnimation>
vec4 worldPos=finalWorld*vec4(offsetPosition,1.0);gl_Position=viewProjection*worldPos;
#ifdef ALPHATEST
#ifdef UV1
vUV=vec2(diffuseMatrix*vec4(uvUpdated,1.0,0.0));
#endif
#ifdef UV2
vUV=vec2(diffuseMatrix*vec4(uv2Updated,1.0,0.0));
#endif
#endif
#include<clipPlaneVertex>
#include<logDepthVertex>
}
`;e.ShadersStore[a]||(e.ShadersStore[a]=i);const h=[o,r,c,l,u,V,v,f,m,n,d,s,p,x];for(const t of h)e.IncludesShadersStore[t.name]||(e.IncludesShadersStore[t.name]=t.shader);const A={name:a,shader:i};export{A as outlineVertexShader};
