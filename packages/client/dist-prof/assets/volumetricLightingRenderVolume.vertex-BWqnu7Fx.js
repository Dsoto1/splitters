import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
import { s as sceneVertexDeclaration } from "./sceneVertexDeclaration-CNTvPUi6.js";
import { s as sceneUboDeclaration } from "./sceneUboDeclaration-CFURaA3t.js";
import { m as meshVertexDeclaration } from "./shadowMap.vertex-CuLCSojM.js";
import { m as meshUboDeclaration } from "./meshUboDeclaration-DahcYBU-.js";
import "./bakedVertexAnimation-D_Sv770W.js";
import "./morphTargetsVertex-ChAeSZCm.js";
import "./helperFunctions-Cbwc0-4F.js";
import "./clipPlaneVertex-BdoNWmEf.js";
const name = "volumetricLightingRenderVolumeVertexShader";
const shader = `#include<__decl__sceneVertex>
#include<__decl__meshVertex>
attribute vec3 position;varying vec4 vWorldPos;void main(void) {vec4 worldPos=world*vec4(position,1.0);vWorldPos=worldPos;gl_Position=viewProjection*worldPos;}
`;
if (!ShaderStore.ShadersStore[name]) {
  ShaderStore.ShadersStore[name] = shader;
}
const includes = [sceneVertexDeclaration, sceneUboDeclaration, meshVertexDeclaration, meshUboDeclaration];
for (const inc of includes) {
  if (!ShaderStore.IncludesShadersStore[inc.name]) {
    ShaderStore.IncludesShadersStore[inc.name] = inc.shader;
  }
}
const volumetricLightingRenderVolumeVertexShader = { name, shader };
export {
  volumetricLightingRenderVolumeVertexShader
};
