import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
const name = "sceneVertexDeclaration";
const shader = `uniform mat4 viewProjection;
#ifdef MULTIVIEW
uniform mat4 viewProjectionR;
#endif
uniform mat4 view;uniform mat4 projection;uniform vec4 vEyePosition;
`;
if (!ShaderStore.IncludesShadersStore[name]) {
  ShaderStore.IncludesShadersStore[name] = shader;
}
const sceneVertexDeclaration = { name, shader };
export {
  sceneVertexDeclaration as s
};
