import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
import { c as clipPlaneFragmentDeclaration, a as clipPlaneFragment } from "./clipPlaneFragment-D8NTl-r6.js";
import { logDepthDeclaration } from "./logDepthDeclaration-CQzyhobd.js";
import { l as logDepthFragment } from "./logDepthFragment-DPo7Bo0h.js";
const name = "linePixelShader";
const shader = `#include<clipPlaneFragmentDeclaration>
uniform vec4 color;
#ifdef LOGARITHMICDEPTH
#extension GL_EXT_frag_depth : enable
#endif
#include<logDepthDeclaration>
#define CUSTOM_FRAGMENT_DEFINITIONS
void main(void) {
#define CUSTOM_FRAGMENT_MAIN_BEGIN
#include<logDepthFragment>
#include<clipPlaneFragment>
gl_FragColor=color;
#define CUSTOM_FRAGMENT_MAIN_END
}`;
if (!ShaderStore.ShadersStore[name]) {
  ShaderStore.ShadersStore[name] = shader;
}
const includes = [clipPlaneFragmentDeclaration, logDepthDeclaration, logDepthFragment, clipPlaneFragment];
for (const inc of includes) {
  if (!ShaderStore.IncludesShadersStore[inc.name]) {
    ShaderStore.IncludesShadersStore[inc.name] = inc.shader;
  }
}
const linePixelShader = { name, shader };
export {
  linePixelShader
};
