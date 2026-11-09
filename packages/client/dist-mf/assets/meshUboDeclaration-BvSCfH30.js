import{K as e}from"./babylon-89dYjaND.js";const o="meshUboDeclaration",i=`#ifdef WEBGL2
uniform mat4 world;uniform float visibility;
#else
layout(std140,column_major) uniform;uniform Mesh
{mat4 world;float visibility;};
#endif
#define WORLD_UBO
`;e.IncludesShadersStore[o]||(e.IncludesShadersStore[o]=i);const t={name:o,shader:i};export{t as m};
