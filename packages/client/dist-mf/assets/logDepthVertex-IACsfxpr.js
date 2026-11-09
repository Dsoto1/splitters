import{K as t}from"./babylon-89dYjaND.js";const e="logDepthVertex",o=`#ifdef LOGARITHMICDEPTH
vFragmentDepth=1.0+gl_Position.w;gl_Position.z=log2(max(0.000001,vFragmentDepth))*logarithmicDepthConstant;
#endif
`;t.IncludesShadersStore[e]||(t.IncludesShadersStore[e]=o);const n={name:e,shader:o};export{n as l};
