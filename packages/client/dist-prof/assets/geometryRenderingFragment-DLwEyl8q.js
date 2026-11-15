import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
import "./logDepthFragment-DPo7Bo0h.js";
import "./fogFragment-Dp8mD_y1.js";
const name$1 = "gaussianSplattingFragmentDeclaration";
const shader$1 = `vec4 gaussianColor(vec4 inColor)
{float A=-dot(vPosition,vPosition);if (A<-4.0) discard;float B=exp(A)*inColor.a;
#include<logDepthFragment>
vec3 color=inColor.rgb;
#ifdef FOG
#include<fogFragment>
#endif
return vec4(color,B);}
`;
if (!ShaderStore.IncludesShadersStore[name$1]) {
  ShaderStore.IncludesShadersStore[name$1] = shader$1;
}
const gaussianSplattingFragmentDeclaration = { name: name$1, shader: shader$1 };
const gaussianSplattingFragmentDeclaration$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  gaussianSplattingFragmentDeclaration
}, Symbol.toStringTag, { value: "Module" }));
const name = "geometryRenderingFragment";
const shader = `#ifdef PREPASS
#if SCENE_MRT_COUNT>0
float geometryCoverage=geometryColor.a>0.4 ? 1.0 : 0.0;
#ifdef PREPASS_COLOR
WRITE_GEOMETRY_FRAGMENT_OUTPUT(PREPASS_COLOR_INDEX,geometryColor);
#endif
#ifdef PREPASS_POSITION
WRITE_GEOMETRY_FRAGMENT_OUTPUT(PREPASS_POSITION_INDEX,vec4(geometryPositionW,geometryCoverage));
#endif
#ifdef PREPASS_LOCAL_POSITION
WRITE_GEOMETRY_FRAGMENT_OUTPUT(PREPASS_LOCAL_POSITION_INDEX,vec4(geometryPositionL,geometryCoverage));
#endif
#ifdef PREPASS_DEPTH
WRITE_GEOMETRY_FRAGMENT_OUTPUT(PREPASS_DEPTH_INDEX,vec4(geometryViewDepth,0.0,0.0,geometryCoverage));
#endif
#ifdef PREPASS_NORMALIZED_VIEW_DEPTH
WRITE_GEOMETRY_FRAGMENT_OUTPUT(PREPASS_NORMALIZED_VIEW_DEPTH_INDEX,vec4(geometryNormalizedViewDepth,0.0,0.0,geometryCoverage));
#endif
#ifdef PREPASS_SCREENSPACE_DEPTH
WRITE_GEOMETRY_FRAGMENT_OUTPUT(PREPASS_SCREENSPACE_DEPTH_INDEX,vec4(gl_FragCoord.z,0.0,0.0,geometryCoverage));
#endif
#ifdef PREPASS_NORMAL
WRITE_GEOMETRY_FRAGMENT_OUTPUT(PREPASS_NORMAL_INDEX,vec4(geometryNormalV,geometryCoverage));
#endif
#ifdef PREPASS_WORLD_NORMAL
WRITE_GEOMETRY_FRAGMENT_OUTPUT(PREPASS_WORLD_NORMAL_INDEX,vec4(geometryNormalW*0.5+0.5,geometryCoverage));
#endif
#ifdef PREPASS_ALBEDO
WRITE_GEOMETRY_FRAGMENT_OUTPUT(PREPASS_ALBEDO_INDEX,vec4(geometryAlbedo,geometryCoverage));
#endif
#ifdef PREPASS_ALBEDO_SQRT
WRITE_GEOMETRY_FRAGMENT_OUTPUT(PREPASS_ALBEDO_SQRT_INDEX,vec4(sqrt(max(geometryAlbedo,vec3(0.0))),geometryCoverage));
#endif
#ifdef PREPASS_REFLECTIVITY
WRITE_GEOMETRY_FRAGMENT_OUTPUT(PREPASS_REFLECTIVITY_INDEX,vec4(0.0,0.0,0.0,geometryCoverage));
#endif
#ifdef PREPASS_IRRADIANCE
WRITE_GEOMETRY_FRAGMENT_OUTPUT(PREPASS_IRRADIANCE_INDEX,vec4(0.0,0.0,0.0,geometryCoverage));
#endif
#ifdef PREPASS_IRRADIANCE_LEGACY
WRITE_GEOMETRY_FRAGMENT_OUTPUT(PREPASS_IRRADIANCE_LEGACY_INDEX,vec4(0.0));
#endif
#if defined(PREPASS_VELOCITY) || defined(PREPASS_VELOCITY_LINEAR)
#ifdef PREPASS_VELOCITY_ZERO
vec2 geometryMotion=vec2(0.0);
#else
vec2 geometryMotion=0.5*(geometryCurrentPosition.xy/geometryCurrentPosition.w-geometryPreviousPosition.xy/geometryPreviousPosition.w);
#endif
#ifdef PREPASS_VELOCITY
WRITE_GEOMETRY_FRAGMENT_OUTPUT(PREPASS_VELOCITY_INDEX,vec4(pow(abs(geometryMotion),vec2(1.0/3.0))*sign(geometryMotion)*0.5+0.5,0.0,geometryCoverage));
#endif
#ifdef PREPASS_VELOCITY_LINEAR
WRITE_GEOMETRY_FRAGMENT_OUTPUT(PREPASS_VELOCITY_LINEAR_INDEX,vec4(-geometryMotion,0.0,geometryCoverage));
#endif
#endif
#ifdef PREPASS_OBJECT_ID
WRITE_GEOMETRY_FRAGMENT_OUTPUT(PREPASS_OBJECT_ID_INDEX,encodeObjectId(objectId)*geometryCoverage);
#endif
#ifdef PREPASS_MESH_BLEND_TAG
meshBlendTagOutput=geometryCoverage>0.0 ? uvec4(uint(meshBlendTag),0u,0u,0u) : uvec4(0u);
#endif
#endif
#endif
`;
if (!ShaderStore.IncludesShadersStore[name]) {
  ShaderStore.IncludesShadersStore[name] = shader;
}
const geometryRenderingFragment = { name, shader };
export {
  geometryRenderingFragment as a,
  gaussianSplattingFragmentDeclaration$1 as b,
  gaussianSplattingFragmentDeclaration as g
};
