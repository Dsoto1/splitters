import{K as o}from"./babylon-89dYjaND.js";const e="sceneUboDeclaration",t=`layout(std140,column_major) uniform;uniform Scene {mat4 viewProjection;
#ifdef MULTIVIEW
mat4 viewProjectionR;
#endif 
mat4 view;mat4 projection;vec4 vEyePosition;mat4 inverseProjection;};
`;o.IncludesShadersStore[e]||(o.IncludesShadersStore[e]=t);const r={name:e,shader:t};export{r as s};
