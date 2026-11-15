import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
const name = "pointCloudVertex";
const shader = `#if defined(POINTSIZE) && !defined(WEBGPU)
gl_PointSize=pointSize;
#endif
`;
if (!ShaderStore.IncludesShadersStore[name]) {
  ShaderStore.IncludesShadersStore[name] = shader;
}
const pointCloudVertex = { name, shader };
export {
  pointCloudVertex as p
};
