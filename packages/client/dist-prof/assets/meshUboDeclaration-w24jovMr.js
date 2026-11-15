import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
const name = "meshUboDeclaration";
const shader = `struct Mesh {world : mat4x4<f32>,
visibility : f32,};var<uniform> mesh : Mesh;
#define WORLD_UBO
`;
if (!ShaderStore.IncludesShadersStoreWGSL[name]) {
  ShaderStore.IncludesShadersStoreWGSL[name] = shader;
}
const meshUboDeclarationWGSL = { name, shader };
export {
  meshUboDeclarationWGSL as m
};
