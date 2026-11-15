import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
const name = "decalFragment";
const shader = `#ifdef DECAL
#ifdef GAMMADECAL
decalColor.rgb=toLinearSpace(decalColor.rgb);
#endif
#ifdef DECAL_SMOOTHALPHA
decalColor.a*=decalColor.a;
#endif
surfaceAlbedo.rgb=mix(surfaceAlbedo.rgb,decalColor.rgb,decalColor.a);
#endif
`;
if (!ShaderStore.IncludesShadersStore[name]) {
  ShaderStore.IncludesShadersStore[name] = shader;
}
const decalFragment = { name, shader };
export {
  decalFragment as d
};
