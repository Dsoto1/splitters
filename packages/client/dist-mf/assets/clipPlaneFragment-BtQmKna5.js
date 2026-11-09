import{K as e}from"./babylon-89dYjaND.js";const i="clipPlaneFragmentDeclaration",n=`#ifdef CLIPPLANE
varying float fClipDistance;
#endif
#ifdef CLIPPLANE2
varying float fClipDistance2;
#endif
#ifdef CLIPPLANE3
varying float fClipDistance3;
#endif
#ifdef CLIPPLANE4
varying float fClipDistance4;
#endif
#ifdef CLIPPLANE5
varying float fClipDistance5;
#endif
#ifdef CLIPPLANE6
varying float fClipDistance6;
#endif
`;e.IncludesShadersStore[i]||(e.IncludesShadersStore[i]=n);const d={name:i,shader:n},s=Object.freeze(Object.defineProperty({__proto__:null,clipPlaneFragmentDeclaration:d},Symbol.toStringTag,{value:"Module"})),f="clipPlaneFragment",a=`#if defined(CLIPPLANE) || defined(CLIPPLANE2) || defined(CLIPPLANE3) || defined(CLIPPLANE4) || defined(CLIPPLANE5) || defined(CLIPPLANE6)
if (false) {}
#endif
#ifdef CLIPPLANE
else if (fClipDistance>0.0)
{discard;}
#endif
#ifdef CLIPPLANE2
else if (fClipDistance2>0.0)
{discard;}
#endif
#ifdef CLIPPLANE3
else if (fClipDistance3>0.0)
{discard;}
#endif
#ifdef CLIPPLANE4
else if (fClipDistance4>0.0)
{discard;}
#endif
#ifdef CLIPPLANE5
else if (fClipDistance5>0.0)
{discard;}
#endif
#ifdef CLIPPLANE6
else if (fClipDistance6>0.0)
{discard;}
#endif
`;e.IncludesShadersStore[f]||(e.IncludesShadersStore[f]=a);const l={name:f,shader:a},r=Object.freeze(Object.defineProperty({__proto__:null,clipPlaneFragment:l},Symbol.toStringTag,{value:"Module"}));export{l as a,s as b,d as c,r as d};
