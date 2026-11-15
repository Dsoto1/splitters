import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
import "./objectIdFunctions-CSQgrKyq.js";
const name$1 = "prePassDeclaration";
const shader$1 = `#ifdef PREPASS
#ifndef PREPASS_CUSTOM_VARYINGS
#ifdef PREPASS_LOCAL_POSITION
varying vPosition : vec3f;
#endif
#ifdef PREPASS_DEPTH
varying vViewPos: vec3f;
#endif
#ifdef PREPASS_NORMALIZED_VIEW_DEPTH
varying vNormViewDepth: f32;
#endif
#if (defined(PREPASS_VELOCITY) || defined(PREPASS_VELOCITY_LINEAR)) && !defined(PREPASS_VELOCITY_ZERO)
varying vCurrentPosition: vec4f;varying vPreviousPosition: vec4f;
#endif
#endif
#ifdef PREPASS_OBJECT_ID
uniform objectId: f32;
#include<objectIdFunctions>
#endif
#ifdef PREPASS_MESH_BLEND_TAG
uniform meshBlendTag: i32;
#endif
#endif
`;
if (!ShaderStore.IncludesShadersStoreWGSL[name$1]) {
  ShaderStore.IncludesShadersStoreWGSL[name$1] = shader$1;
}
const prePassDeclarationWGSL = { name: name$1, shader: shader$1 };
const name = "meshBlendTagFragmentOutput";
const shader = `#if SCENE_MRT_COUNT>{X}
#if defined(PREPASS_MESH_BLEND_TAG) && PREPASS_MESH_BLEND_TAG_INDEX=={X}
fragmentOutputs.fragData{X}=meshBlendTagOutput;
#else
fragmentOutputs.fragData{X}=fragData[{X}];
#endif
#endif
`;
if (!ShaderStore.IncludesShadersStoreWGSL[name]) {
  ShaderStore.IncludesShadersStoreWGSL[name] = shader;
}
const meshBlendTagFragmentOutputWGSL = { name, shader };
export {
  meshBlendTagFragmentOutputWGSL as m,
  prePassDeclarationWGSL as p
};
