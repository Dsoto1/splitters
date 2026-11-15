import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
import { c as clipPlaneFragmentDeclarationWGSL, a as clipPlaneFragmentWGSL } from "./clipPlaneFragment-BbExy4ec.js";
import { logDepthDeclarationWGSL } from "./logDepthDeclaration-Cf0EhojL.js";
import { l as logDepthFragmentWGSL } from "./logDepthFragment-81Y6Jflh.js";
const name = "linePixelShader";
const shader = `#include<clipPlaneFragmentDeclaration>
uniform color: vec4f;
#include<logDepthDeclaration>
#define CUSTOM_FRAGMENT_DEFINITIONS
@fragment
fn main(input: FragmentInputs)->FragmentOutputs {
#define CUSTOM_FRAGMENT_MAIN_BEGIN
#include<logDepthFragment>
#include<clipPlaneFragment>
fragmentOutputs.color=uniforms.color;
#define CUSTOM_FRAGMENT_MAIN_END
}`;
if (!ShaderStore.ShadersStoreWGSL[name]) {
  ShaderStore.ShadersStoreWGSL[name] = shader;
}
const includes = [clipPlaneFragmentDeclarationWGSL, logDepthDeclarationWGSL, logDepthFragmentWGSL, clipPlaneFragmentWGSL];
for (const inc of includes) {
  if (!ShaderStore.IncludesShadersStoreWGSL[inc.name]) {
    ShaderStore.IncludesShadersStoreWGSL[inc.name] = inc.shader;
  }
}
const linePixelShaderWGSL = { name, shader };
export {
  linePixelShaderWGSL
};
