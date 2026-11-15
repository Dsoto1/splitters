import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
const name = "oitFinalSimpleBlendPixelShader";
const shader = `var uFrontColor: texture_2d<f32>;@fragment
fn main(input: FragmentInputs)->FragmentOutputs {var fragCoord: vec2i=vec2i(fragmentInputs.position.xy);var frontColor: vec4f=textureLoad(uFrontColor,fragCoord,0);fragmentOutputs.color=frontColor;}
`;
if (!ShaderStore.ShadersStoreWGSL[name]) {
  ShaderStore.ShadersStoreWGSL[name] = shader;
}
const oitFinalSimpleBlendPixelShaderWGSL = { name, shader };
export {
  oitFinalSimpleBlendPixelShaderWGSL
};
