import{K as e}from"./babylon-89dYjaND.js";import{c as o,a as i}from"./clipPlaneFragment-BtQmKna5.js";import{logDepthDeclaration as l}from"./logDepthDeclaration-HFiP813h.js";import{l as t}from"./logDepthFragment-DDmzkqx0.js";const r="linePixelShader",a=`#include<clipPlaneFragmentDeclaration>
uniform vec4 color;
#ifdef LOGARITHMICDEPTH
#extension GL_EXT_frag_depth : enable
#endif
#include<logDepthDeclaration>
#define CUSTOM_FRAGMENT_DEFINITIONS
void main(void) {
#define CUSTOM_FRAGMENT_MAIN_BEGIN
#include<logDepthFragment>
#include<clipPlaneFragment>
gl_FragColor=color;
#define CUSTOM_FRAGMENT_MAIN_END
}`;e.ShadersStore[r]||(e.ShadersStore[r]=a);const c=[o,l,t,i];for(const n of c)e.IncludesShadersStore[n.name]||(e.IncludesShadersStore[n.name]=n.shader);const S={name:r,shader:a};export{S as linePixelShader};
