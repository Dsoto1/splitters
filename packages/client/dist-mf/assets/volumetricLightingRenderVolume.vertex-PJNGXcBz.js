import{K as e}from"./babylon-89dYjaND.js";import{s as n}from"./sceneUboDeclaration-CLQ8FD1J.js";import{m as s}from"./meshUboDeclaration-DXROKkce.js";const r="volumetricLightingRenderVolumeVertexShader",t=`#include<sceneUboDeclaration>
#include<meshUboDeclaration>
attribute position : vec3f;varying vWorldPos: vec4f;@vertex
fn main(input : VertexInputs)->FragmentInputs {let worldPos=mesh.world*vec4f(vertexInputs.position,1.0);vertexOutputs.vWorldPos=worldPos;vertexOutputs.position=scene.viewProjection*worldPos;}
`;e.ShadersStoreWGSL[r]||(e.ShadersStoreWGSL[r]=t);const i=[n,s];for(const o of i)e.IncludesShadersStoreWGSL[o.name]||(e.IncludesShadersStoreWGSL[o.name]=o.shader);const l={name:r,shader:t};export{l as volumetricLightingRenderVolumeVertexShaderWGSL};
