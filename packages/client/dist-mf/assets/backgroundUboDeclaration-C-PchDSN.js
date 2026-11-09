import{K as r}from"./babylon-89dYjaND.js";import"./sceneUboDeclaration-DIVgotUo.js";const o="backgroundUboDeclaration",e=`layout(std140,column_major) uniform;uniform Material
{uniform vec4 vPrimaryColor;uniform vec4 vPrimaryColorShadow;uniform vec2 vDiffuseInfos;uniform mat4 diffuseMatrix;uniform float fFovMultiplier;uniform float pointSize;uniform float shadowLevel;uniform float alpha;uniform vec3 vBackgroundCenter;uniform vec4 vReflectionControl;uniform vec2 projectedGroundInfos;uniform vec2 vReflectionInfos;uniform mat4 reflectionMatrix;uniform vec3 vReflectionMicrosurfaceInfos;};
#include<sceneUboDeclaration>
`;r.IncludesShadersStore[o]||(r.IncludesShadersStore[o]=e);const f={name:o,shader:e};export{f as b};
