import{K as e}from"./babylon-89dYjaND.js";import{helperFunctions as a}from"./helperFunctions-DuJdYcOd.js";const o="extractHighlightsPixelShader",t=`#include<helperFunctions>
varying vec2 vUV;uniform sampler2D textureSampler;uniform float threshold;uniform float exposure;
#define CUSTOM_FRAGMENT_DEFINITIONS
void main(void) 
{gl_FragColor=texture2D(textureSampler,vUV);float luma=dot(LuminanceEncodeApprox,gl_FragColor.rgb*exposure);gl_FragColor.rgb=step(threshold,luma)*gl_FragColor.rgb;}`;e.ShadersStore[o]||(e.ShadersStore[o]=t);const l=[a];for(const r of l)e.IncludesShadersStore[r.name]||(e.IncludesShadersStore[r.name]=r.shader);const i={name:o,shader:t};export{i as extractHighlightsPixelShader};
