import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
const name = "oitFinalSimpleBlendPixelShader";
const shader = `precision highp float;uniform sampler2D uFrontColor;void main() {ivec2 fragCoord=ivec2(gl_FragCoord.xy);vec4 frontColor=texelFetch(uFrontColor,fragCoord,0);glFragColor=frontColor;}
`;
if (!ShaderStore.ShadersStore[name]) {
  ShaderStore.ShadersStore[name] = shader;
}
const oitFinalSimpleBlendPixelShader = { name, shader };
export {
  oitFinalSimpleBlendPixelShader
};
