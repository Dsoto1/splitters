import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
const name$3 = "morphTargetsVertexGlobalDeclaration";
const shader$3 = `#ifdef MORPHTARGETS
uniform morphTargetInfluences : array<f32,NUM_MORPH_INFLUENCERS>;
#ifdef MORPHTARGETS_TEXTURE 
uniform morphTargetTextureIndices : array<f32,NUM_MORPH_INFLUENCERS>;uniform morphTargetTextureInfo : vec3<f32>;var morphTargets : texture_2d_array<f32>;fn readVector3FromRawSampler(targetIndex : i32,vertexIndex : f32)->vec3<f32>
{ 
let textureWidth: i32=i32(uniforms.morphTargetTextureInfo.y);let y: i32=i32(vertexIndex)/textureWidth;let x: i32=i32(vertexIndex) % textureWidth;return textureLoad(morphTargets,vec2i(x,y),i32(uniforms.morphTargetTextureIndices[targetIndex]),0).xyz;}
fn readVector4FromRawSampler(targetIndex : i32,vertexIndex : f32)->vec4<f32>
{ 
let textureWidth: i32=i32(uniforms.morphTargetTextureInfo.y); 
let y: i32=i32(vertexIndex)/textureWidth;let x: i32=i32(vertexIndex) % textureWidth;return textureLoad(morphTargets,vec2i(x,y),i32(uniforms.morphTargetTextureIndices[targetIndex]),0);}
#endif
#endif
`;
if (!ShaderStore.IncludesShadersStoreWGSL[name$3]) {
  ShaderStore.IncludesShadersStoreWGSL[name$3] = shader$3;
}
const morphTargetsVertexGlobalDeclarationWGSL = { name: name$3, shader: shader$3 };
const morphTargetsVertexGlobalDeclaration = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  morphTargetsVertexGlobalDeclarationWGSL
}, Symbol.toStringTag, { value: "Module" }));
const name$2 = "morphTargetsVertexDeclaration";
const shader$2 = `#ifdef MORPHTARGETS
#ifndef MORPHTARGETS_TEXTURE
#ifdef MORPHTARGETS_POSITION
attribute position{X} : vec3<f32>;
#endif
#ifdef MORPHTARGETS_NORMAL
attribute normal{X} : vec3<f32>;
#endif
#ifdef MORPHTARGETS_TANGENT
attribute tangent{X} : vec3<f32>;
#endif
#ifdef MORPHTARGETS_UV
attribute uv_{X} : vec2<f32>;
#endif
#ifdef MORPHTARGETS_UV2
attribute uv2_{X} : vec2<f32>;
#endif
#ifdef MORPHTARGETS_COLOR
attribute color{X} : vec4<f32>;
#endif
#elif {X}==0
uniform morphTargetCount: f32;
#endif
#endif
`;
if (!ShaderStore.IncludesShadersStoreWGSL[name$2]) {
  ShaderStore.IncludesShadersStoreWGSL[name$2] = shader$2;
}
const morphTargetsVertexDeclarationWGSL = { name: name$2, shader: shader$2 };
const morphTargetsVertexDeclaration = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  morphTargetsVertexDeclarationWGSL
}, Symbol.toStringTag, { value: "Module" }));
const name$1 = "morphTargetsVertexGlobal";
const shader$1 = `#ifdef MORPHTARGETS
#ifdef MORPHTARGETS_TEXTURE
var vertexID : f32;
#endif
#endif
`;
if (!ShaderStore.IncludesShadersStoreWGSL[name$1]) {
  ShaderStore.IncludesShadersStoreWGSL[name$1] = shader$1;
}
const morphTargetsVertexGlobalWGSL = { name: name$1, shader: shader$1 };
const morphTargetsVertexGlobal = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  morphTargetsVertexGlobalWGSL
}, Symbol.toStringTag, { value: "Module" }));
const name = "morphTargetsVertex";
const shader = `#ifdef MORPHTARGETS
#ifdef MORPHTARGETS_TEXTURE
#if {X}==0
for (var i=0; i<NUM_MORPH_INFLUENCERS; i=i+1) {if (f32(i)>=uniforms.morphTargetCount) {break;}
#ifdef USE_VERTEX_PULLING
vertexID=f32(vpVertexIndex)*uniforms.morphTargetTextureInfo.x;
#else
vertexID=f32(vertexInputs.vertexIndex)*uniforms.morphTargetTextureInfo.x;
#endif
#ifdef MORPHTARGETS_POSITION
#ifdef USE_VERTEX_PULLING
positionUpdated=positionUpdated+(readVector3FromRawSampler(i,vertexID)-vp_basePosition)*uniforms.morphTargetInfluences[i];
#else
positionUpdated=positionUpdated+(readVector3FromRawSampler(i,vertexID)-vertexInputs.position)*uniforms.morphTargetInfluences[i];
#endif
#endif
#ifdef MORPHTARGETTEXTURE_HASPOSITIONS
vertexID=vertexID+1.0;
#endif
#ifdef MORPHTARGETS_NORMAL
#ifdef USE_VERTEX_PULLING
normalUpdated=normalUpdated+(readVector3FromRawSampler(i,vertexID) -vp_baseNormal)*uniforms.morphTargetInfluences[i];
#else
normalUpdated=normalUpdated+(readVector3FromRawSampler(i,vertexID) -vertexInputs.normal)*uniforms.morphTargetInfluences[i];
#endif
#endif
#ifdef MORPHTARGETTEXTURE_HASNORMALS
vertexID=vertexID+1.0;
#endif
#ifdef MORPHTARGETS_UV
#ifdef USE_VERTEX_PULLING
uvUpdated=uvUpdated+(readVector3FromRawSampler(i,vertexID).xy-vp_baseUV)*uniforms.morphTargetInfluences[i];
#else
uvUpdated=uvUpdated+(readVector3FromRawSampler(i,vertexID).xy-vertexInputs.uv)*uniforms.morphTargetInfluences[i];
#endif
#endif
#ifdef MORPHTARGETTEXTURE_HASUVS
vertexID=vertexID+1.0;
#endif
#ifdef MORPHTARGETS_TANGENT
#ifdef USE_VERTEX_PULLING
tangentUpdated=vec4f(tangentUpdated.xyz+(readVector3FromRawSampler(i,vertexID) -vp_baseTangent.xyz)*uniforms.morphTargetInfluences[i],tangentUpdated.a);
#else
tangentUpdated=vec4f(tangentUpdated.xyz+(readVector3FromRawSampler(i,vertexID) -vertexInputs.tangent.xyz)*uniforms.morphTargetInfluences[i],tangentUpdated.a);
#endif
#endif
#ifdef MORPHTARGETTEXTURE_HASTANGENTS
vertexID=vertexID+1.0;
#endif
#ifdef MORPHTARGETS_UV2
#ifdef USE_VERTEX_PULLING
uv2Updated=uv2Updated+(readVector3FromRawSampler(i,vertexID).xy-vp_baseUV2)*uniforms.morphTargetInfluences[i];
#else
uv2Updated=uv2Updated+(readVector3FromRawSampler(i,vertexID).xy-vertexInputs.uv2)*uniforms.morphTargetInfluences[i];
#endif
#endif
#ifdef MORPHTARGETS_COLOR
#ifdef USE_VERTEX_PULLING
colorUpdated=colorUpdated+(readVector4FromRawSampler(i,vertexID)-vp_baseColor)*uniforms.morphTargetInfluences[i];
#else
colorUpdated=colorUpdated+(readVector4FromRawSampler(i,vertexID)-vertexInputs.color)*uniforms.morphTargetInfluences[i];
#endif
#endif
}
#endif
#else
#ifdef MORPHTARGETS_POSITION
#ifdef USE_VERTEX_PULLING
positionUpdated=positionUpdated+(vertexInputs.position{X}-vp_basePosition)*uniforms.morphTargetInfluences[{X}];
#else
positionUpdated=positionUpdated+(vertexInputs.position{X}-vertexInputs.position)*uniforms.morphTargetInfluences[{X}];
#endif
#endif
#ifdef MORPHTARGETS_NORMAL
#ifdef USE_VERTEX_PULLING
normalUpdated=normalUpdated+(vertexInputs.normal{X}-vp_baseNormal)*uniforms.morphTargetInfluences[{X}];
#else
normalUpdated=normalUpdated+(vertexInputs.normal{X}-vertexInputs.normal)*uniforms.morphTargetInfluences[{X}];
#endif
#endif
#ifdef MORPHTARGETS_TANGENT
#ifdef USE_VERTEX_PULLING
tangentUpdated=vec4f(tangentUpdated.xyz+(vertexInputs.tangent{X}-vp_baseTangent.xyz)*uniforms.morphTargetInfluences[{X}],tangentUpdated.a);
#else
tangentUpdated=vec4f(tangentUpdated.xyz+(vertexInputs.tangent{X}-vertexInputs.tangent.xyz)*uniforms.morphTargetInfluences[{X}],tangentUpdated.a);
#endif
#endif
#ifdef MORPHTARGETS_UV
#ifdef USE_VERTEX_PULLING
uvUpdated=uvUpdated+(vertexInputs.uv_{X}-vp_baseUV)*uniforms.morphTargetInfluences[{X}];
#else
uvUpdated=uvUpdated+(vertexInputs.uv_{X}-vertexInputs.uv)*uniforms.morphTargetInfluences[{X}];
#endif
#endif
#ifdef MORPHTARGETS_UV2
#ifdef USE_VERTEX_PULLING
uv2Updated=uv2Updated+(vertexInputs.uv2_{X}-vp_baseUV2)*uniforms.morphTargetInfluences[{X}];
#else
uv2Updated=uv2Updated+(vertexInputs.uv2_{X}-vertexInputs.uv2)*uniforms.morphTargetInfluences[{X}];
#endif
#endif
#ifdef MORPHTARGETS_COLOR
#ifdef USE_VERTEX_PULLING
colorUpdated=colorUpdated+(vertexInputs.color{X}-vp_baseColor)*uniforms.morphTargetInfluences[{X}];
#else
colorUpdated=colorUpdated+(vertexInputs.color{X}-vertexInputs.color)*uniforms.morphTargetInfluences[{X}];
#endif
#endif
#endif
#endif
`;
if (!ShaderStore.IncludesShadersStoreWGSL[name]) {
  ShaderStore.IncludesShadersStoreWGSL[name] = shader;
}
const morphTargetsVertexWGSL = { name, shader };
const morphTargetsVertex = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  morphTargetsVertexWGSL
}, Symbol.toStringTag, { value: "Module" }));
export {
  morphTargetsVertexDeclarationWGSL as a,
  morphTargetsVertexGlobalWGSL as b,
  morphTargetsVertexWGSL as c,
  morphTargetsVertexGlobalDeclaration as d,
  morphTargetsVertexDeclaration as e,
  morphTargetsVertexGlobal as f,
  morphTargetsVertex as g,
  morphTargetsVertexGlobalDeclarationWGSL as m
};
