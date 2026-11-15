import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
const name = "sceneUboDeclaration";
const shader = `layout(std140,column_major) uniform;uniform Scene {mat4 viewProjection;
#ifdef MULTIVIEW
mat4 viewProjectionR;
#endif 
mat4 view;mat4 projection;vec4 vEyePosition;mat4 inverseProjection;};
`;
if (!ShaderStore.IncludesShadersStore[name]) {
  ShaderStore.IncludesShadersStore[name] = shader;
}
const sceneUboDeclaration = { name, shader };
export {
  sceneUboDeclaration as s
};
