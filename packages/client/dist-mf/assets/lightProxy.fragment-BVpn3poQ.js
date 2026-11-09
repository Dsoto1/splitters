import{K as i}from"./babylon-89dYjaND.js";const r="lightProxyPixelShader",a=`flat varying vec2 vLimits;flat varying highp uint vMask;void main(void) {if (gl_FragCoord.y<vLimits.x || gl_FragCoord.y>vLimits.y) {discard;}
gl_FragColor=vec4(vMask,0,0,1);}
`;i.ShadersStore[r]||(i.ShadersStore[r]=a);const t={name:r,shader:a};export{t as lightProxyPixelShader};
