import{K as a}from"./babylon-89dYjaND.js";const e="decalFragment",d=`#ifdef DECAL
var decalTempColor=decalColor.rgb;var decalTempAlpha=decalColor.a;
#ifdef GAMMADECAL
decalTempColor=toLinearSpaceVec3(decalColor.rgb);
#endif
#ifdef DECAL_SMOOTHALPHA
decalTempAlpha=decalColor.a*decalColor.a;
#endif
surfaceAlbedo=mix(surfaceAlbedo.rgb,decalTempColor,decalTempAlpha);
#endif
`;a.IncludesShadersStoreWGSL[e]||(a.IncludesShadersStoreWGSL[e]=d);const o={name:e,shader:d};export{o as d};
