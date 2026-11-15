import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
const name = "lightProxyPixelShader";
const shader = `flat varying vec2 vLimits;flat varying highp uint vMask;void main(void) {if (gl_FragCoord.y<vLimits.x || gl_FragCoord.y>vLimits.y) {discard;}
gl_FragColor=vec4(vMask,0,0,1);}
`;
if (!ShaderStore.ShadersStore[name]) {
  ShaderStore.ShadersStore[name] = shader;
}
const lightProxyPixelShader = { name, shader };
export {
  lightProxyPixelShader
};
