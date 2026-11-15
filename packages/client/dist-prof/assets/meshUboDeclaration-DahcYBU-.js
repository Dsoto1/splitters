import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
const name = "meshUboDeclaration";
const shader = `#ifdef WEBGL2
uniform mat4 world;uniform float visibility;
#else
layout(std140,column_major) uniform;uniform Mesh
{mat4 world;float visibility;};
#endif
#define WORLD_UBO
`;
if (!ShaderStore.IncludesShadersStore[name]) {
  ShaderStore.IncludesShadersStore[name] = shader;
}
const meshUboDeclaration = { name, shader };
export {
  meshUboDeclaration as m
};
