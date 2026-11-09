import{K as r}from"./babylon-89dYjaND.js";const e="decalFragment",a=`#ifdef DECAL
#ifdef GAMMADECAL
decalColor.rgb=toLinearSpace(decalColor.rgb);
#endif
#ifdef DECAL_SMOOTHALPHA
decalColor.a*=decalColor.a;
#endif
surfaceAlbedo.rgb=mix(surfaceAlbedo.rgb,decalColor.rgb,decalColor.a);
#endif
`;r.IncludesShadersStore[e]||(r.IncludesShadersStore[e]=a);const d={name:e,shader:a};export{d};
