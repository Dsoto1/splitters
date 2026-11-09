import{K as r}from"./babylon-89dYjaND.js";const e="fresnelFunction",o=`#ifdef FRESNEL
fn computeFresnelTerm(viewDirection: vec3f,worldNormal: vec3f,bias: f32,power: f32)->f32
{let fresnelTerm: f32=pow(bias+abs(dot(viewDirection,worldNormal)),power);return clamp(fresnelTerm,0.,1.);}
#endif
`;r.IncludesShadersStoreWGSL[e]||(r.IncludesShadersStoreWGSL[e]=o);const s={name:e,shader:o};export{s as fresnelFunctionWGSL};
