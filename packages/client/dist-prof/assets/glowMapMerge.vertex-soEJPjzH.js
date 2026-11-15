import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
const name = "glowMapMergeVertexShader";
const shader = `attribute vec2 position;varying vec2 vUV;const vec2 madd=vec2(0.5,0.5);
#define CUSTOM_VERTEX_DEFINITIONS
void main(void) {
#define CUSTOM_VERTEX_MAIN_BEGIN
vUV=position*madd+madd;gl_Position=vec4(position,0.0,1.0);
#define CUSTOM_VERTEX_MAIN_END
}`;
if (!ShaderStore.ShadersStore[name]) {
  ShaderStore.ShadersStore[name] = shader;
}
const glowMapMergeVertexShader = { name, shader };
export {
  glowMapMergeVertexShader
};
