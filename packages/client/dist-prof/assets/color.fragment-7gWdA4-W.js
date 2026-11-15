import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
import { c as clipPlaneFragmentDeclarationWGSL, a as clipPlaneFragmentWGSL } from "./clipPlaneFragment-BbExy4ec.js";
import { f as fogFragmentDeclarationWGSL, a as fogFragmentWGSL } from "./fogFragment-Dm1Vlk0e.js";
const name = "colorPixelShader";
const shader = `#if defined(VERTEXCOLOR) || defined(INSTANCESCOLOR) && defined(INSTANCES)
#define VERTEXCOLOR
varying vColor: vec4f;
#else
uniform color: vec4f;
#endif
#include<clipPlaneFragmentDeclaration>
#include<fogFragmentDeclaration>
#define CUSTOM_FRAGMENT_DEFINITIONS
@fragment
fn main(input: FragmentInputs)->FragmentOutputs {
#define CUSTOM_FRAGMENT_MAIN_BEGIN
#include<clipPlaneFragment>
#if defined(VERTEXCOLOR) || defined(INSTANCESCOLOR) && defined(INSTANCES)
fragmentOutputs.color=input.vColor;
#else
fragmentOutputs.color=uniforms.color;
#endif
#include<fogFragment>(color,fragmentOutputs.color)
#define CUSTOM_FRAGMENT_MAIN_END
}`;
if (!ShaderStore.ShadersStoreWGSL[name]) {
  ShaderStore.ShadersStoreWGSL[name] = shader;
}
const includes = [clipPlaneFragmentDeclarationWGSL, fogFragmentDeclarationWGSL, clipPlaneFragmentWGSL, fogFragmentWGSL];
for (const inc of includes) {
  if (!ShaderStore.IncludesShadersStoreWGSL[inc.name]) {
    ShaderStore.IncludesShadersStoreWGSL[inc.name] = inc.shader;
  }
}
const colorPixelShaderWGSL = { name, shader };
export {
  colorPixelShaderWGSL
};
