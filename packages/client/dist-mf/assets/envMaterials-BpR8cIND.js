import{j as b,h as p,G as y,aB as c,a as S,bt as u}from"./babylon-89dYjaND.js";import"./materialPluginBase-BWxh2sg5.js";import{aF as h,aE as R}from"./index-BQMKiamJ.js";var o;(function(l){l[l.GLSL=0]="GLSL",l[l.WGSL=1]="WGSL"})(o||(o={}));const v={bark:"env/bark.webp",barkNormal:"env/bark_n.webp",rock:"env/rock.webp",rockNormal:"env/rock_n.webp",leaves:"env/leaves.webp"},C=[{id:"env.broadleaf.oak",category:"tree",role:"cover",lods:[0,30,70,140],triangles:[2504,982,254,4],variants:[{index:0,name:"summer",file:"env/broadleaf.oak.summer.glb"},{index:1,name:"autumn",file:"env/broadleaf.oak.autumn.glb"}]},{id:"env.broadleaf.maple",category:"tree",role:"cover",lods:[0,30,70,140],triangles:[2148,954,278,4],variants:[{index:0,name:"summer",file:"env/broadleaf.maple.summer.glb"},{index:1,name:"autumn",file:"env/broadleaf.maple.autumn.glb"}]},{id:"env.broadleaf.acacia",category:"tree",role:"cover",lods:[0,30,70,140],triangles:[2468,906,264,4],variants:[{index:0,name:"green",file:"env/broadleaf.acacia.green.glb"},{index:1,name:"dry",file:"env/broadleaf.acacia.dry.glb"}]},{id:"env.cactus.saguaro",category:"tree",role:"cover",lods:[0,30,70,140],triangles:[1968,648,276,4],variants:[{index:0,name:"green",file:"env/cactus.saguaro.green.glb"},{index:1,name:"dry",file:"env/cactus.saguaro.dry.glb"}]},{id:"env.cliff.face",category:"cliff",role:"blocking",lods:[0,40,100],triangles:[2124,696,192],variants:[{index:0,name:"bare",file:"env/cliff.face.bare.glb"},{index:1,name:"snow",file:"env/cliff.face.snow.glb"}]},{id:"env.conifer.pine_tall",category:"tree",role:"cover",lods:[0,30,70,140],triangles:[2208,534,138,4],variants:[{index:0,name:"summer",file:"env/conifer.pine_tall.summer.glb"},{index:1,name:"snow",file:"env/conifer.pine_tall.snow.glb"}]},{id:"env.conifer.spruce",category:"tree",role:"cover",lods:[0,30,70,140],triangles:[2662,612,174,4],variants:[{index:0,name:"summer",file:"env/conifer.spruce.summer.glb"},{index:1,name:"snow",file:"env/conifer.spruce.snow.glb"}]},{id:"env.fern.bracken",category:"groundcover",role:"cover",lods:[0],triangles:[56],variants:[{index:0,name:"summer",file:"env/fern.bracken.summer.glb"},{index:1,name:"autumn",file:"env/fern.bracken.autumn.glb"}]},{id:"env.flower.meadow",category:"groundcover",role:"decorative",lods:[0],triangles:[27],variants:[{index:0,name:"white",file:"env/flower.meadow.white.glb"},{index:1,name:"yellow",file:"env/flower.meadow.yellow.glb"},{index:2,name:"purple",file:"env/flower.meadow.purple.glb"},{index:3,name:"red",file:"env/flower.meadow.red.glb"}]},{id:"env.grass.clump",category:"groundcover",role:"decorative",lods:[0],triangles:[35],variants:[{index:0,name:"summer",file:"env/grass.clump.summer.glb"},{index:1,name:"dry",file:"env/grass.clump.dry.glb"}]},{id:"env.hedge.privet",category:"plant",role:"blocking",lods:[0,25,90],triangles:[670,190,4],variants:[{index:0,name:"green",file:"env/hedge.privet.green.glb"},{index:1,name:"autumn",file:"env/hedge.privet.autumn.glb"}]},{id:"env.hedge.yew",category:"plant",role:"blocking",lods:[0,25,90],triangles:[662,188,4],variants:[{index:0,name:"green",file:"env/hedge.yew.green.glb"},{index:1,name:"snow",file:"env/hedge.yew.snow.glb"}]},{id:"env.palm.coconut",category:"tree",role:"cover",lods:[0,30,70,140],triangles:[976,336,128,4],variants:[{index:0,name:"green",file:"env/palm.coconut.green.glb"},{index:1,name:"dry",file:"env/palm.coconut.dry.glb"}]},{id:"env.palm.leaning",category:"tree",role:"cover",lods:[0,30,70,140],triangles:[932,348,128,4],variants:[{index:0,name:"green",file:"env/palm.leaning.green.glb"},{index:1,name:"dry",file:"env/palm.leaning.dry.glb"}]},{id:"env.rock.boulder_angular",category:"boulder",role:"cover",lods:[0,30,80],triangles:[700,220,60],variants:[{index:0,name:"bare",file:"env/rock.boulder_angular.bare.glb"},{index:1,name:"moss",file:"env/rock.boulder_angular.moss.glb"}]},{id:"env.rock.pebbles",category:"rock",role:"decorative",lods:[0],triangles:[60],variants:[{index:0,name:"grey",file:"env/rock.pebbles.grey.glb"},{index:1,name:"sand",file:"env/rock.pebbles.sand.glb"}]},{id:"env.shrub.broadleaf",category:"plant",role:"cover",lods:[0,25,60],triangles:[400,100,4],variants:[{index:0,name:"summer",file:"env/shrub.broadleaf.summer.glb"},{index:1,name:"autumn",file:"env/shrub.broadleaf.autumn.glb"}]},{id:"env.shrub.laurel",category:"plant",role:"cover",lods:[0,25,60],triangles:[440,108,4],variants:[{index:0,name:"green",file:"env/shrub.laurel.green.glb"},{index:1,name:"dry",file:"env/shrub.laurel.dry.glb"}]},{id:"env.water.eelgrass",category:"groundcover",role:"decorative",lods:[0],triangles:[49],variants:[{index:0,name:"green",file:"env/water.eelgrass.green.glb"},{index:1,name:"olive",file:"env/water.eelgrass.olive.glb"}]}],s={low:{lodScale:.6,wind:0,normals:!1},medium:{lodScale:.8,wind:.6,normals:!0},high:{lodScale:1,wind:1,normals:!0}},k=[1/2.6,1/13.8,1.4],d=3.1.toFixed(2),m="envWind";class P extends u{constructor(e,r){super(e,"EnvWind",200,{ENVWIND:!1}),this.params=r,this._enable(!0)}params;getClassName(){return"EnvWindPlugin"}isCompatible(e){return e===o.GLSL||e===o.WGSL}prepareDefines(e){e.ENVWIND=!0}getAttributes(e){e.push(m)}getUniforms(){return{ubo:[{name:"envWindParams",size:4,type:"vec4"}],vertex:`#ifdef ENVWIND
uniform vec4 envWindParams;
#endif
`}}bindForSubMesh(e,r,a,n){e.updateFloat4("envWindParams",this.params.time,this.params.strength,0,0)}getCustomCode(e,r=o.GLSL){return e!=="vertex"?null:r===o.WGSL?{CUSTOM_VERTEX_DEFINITIONS:`attribute envWind: vec2f;
`,CUSTOM_VERTEX_UPDATE_WORLDPOS:`
{
  let envW = vertexInputs.envWind;
  let envP = uniforms.envWindParams;
  let envBase = finalWorld[3].xyz;
  let envPh = dot(envBase.xz, vec2f(0.13, 0.17));
  let envS = (sin(envP.x * 1.1 + envPh) * 0.6 + sin(envP.x * 2.3 + envPh * 1.7) * 0.25) * envP.y * envW.x;
  worldPos = vec4f(worldPos.xyz + vec3f(0.94, 0.0, 0.33) * envS * 0.35 + vec3f(0.0, -abs(envS) * 0.05, 0.0)
    + envW.y * envP.y * 0.035 * vec3f(sin(envP.x * 7.0 + worldPos.y * 3.0 + envPh), sin(envP.x * 6.0 + worldPos.x * 2.0), cos(envP.x * 7.5 + worldPos.z * 3.0)), worldPos.w);
}
`}:{CUSTOM_VERTEX_DEFINITIONS:`attribute vec2 envWind;
`,CUSTOM_VERTEX_UPDATE_WORLDPOS:`
{
  vec3 envBase = finalWorld[3].xyz;
  float envPh = dot(envBase.xz, vec2(0.13, 0.17));
  float envS = (sin(envWindParams.x * 1.1 + envPh) * 0.6 + sin(envWindParams.x * 2.3 + envPh * 1.7) * 0.25) * envWindParams.y * envWind.x;
  worldPos.xyz += vec3(0.94, 0.0, 0.33) * envS * 0.35 + vec3(0.0, -abs(envS) * 0.05, 0.0);
  worldPos.xyz += envWind.y * envWindParams.y * 0.035 * vec3(sin(envWindParams.x * 7.0 + worldPos.y * 3.0 + envPh), sin(envWindParams.x * 6.0 + worldPos.x * 2.0), cos(envWindParams.x * 7.5 + worldPos.z * 3.0));
}
`}}}class W extends u{constructor(e,r,a,n){super(e,"EnvRock",150,{ENVROCK:!1}),this.albedo=r,this.normal=a,this.params=n,this._enable(!0)}albedo;normal;params;getClassName(){return"EnvRockPlugin"}isCompatible(e){return e===o.GLSL||e===o.WGSL}isReadyForSubMesh(){return this.albedo.isReady()&&this.normal.isReady()}prepareDefines(e){e.ENVROCK=!0}getSamplers(e){e.push("envRockAlbedoSampler","envRockNormalSampler")}getActiveTextures(e){e.push(this.albedo,this.normal)}hasTexture(e){return e===this.albedo||e===this.normal}getUniforms(){return{ubo:[{name:"envRockParams",size:4,type:"vec4"}],fragment:`#ifdef ENVROCK
uniform vec4 envRockParams;
#endif
`}}bindForSubMesh(e){e.updateFloat4("envRockParams",this.params[0],this.params[1],this.params[2],0),e.setTexture("envRockAlbedoSampler",this.albedo),e.setTexture("envRockNormalSampler",this.normal)}getCustomCode(e,r=o.GLSL){return e!=="fragment"?null:r===o.WGSL?{CUSTOM_FRAGMENT_DEFINITIONS:`
var envRockAlbedoSamplerSampler: sampler;
var envRockAlbedoSampler: texture_2d<f32>;
var envRockNormalSamplerSampler: sampler;
var envRockNormalSampler: texture_2d<f32>;
`,CUSTOM_FRAGMENT_UPDATE_ALPHA:`
var envRough: f32 = uniforms.vReflectivityColor.y;
{
  let envPar = uniforms.envRockParams;
  let envN = normalize(fragmentInputs.vNormalW);
  var envW = pow(abs(envN), vec3f(4.0));
  envW = envW / (envW.x + envW.y + envW.z);
  let envP = fragmentInputs.vPositionW * envPar.x;
  let envCx = textureSample(envRockAlbedoSampler, envRockAlbedoSamplerSampler, envP.zy);
  let envCy = textureSample(envRockAlbedoSampler, envRockAlbedoSamplerSampler, envP.xz);
  let envCz = textureSample(envRockAlbedoSampler, envRockAlbedoSamplerSampler, envP.xy);
  let envC = envCx * envW.x + envCy * envW.y + envCz * envW.z;
  let envQ = fragmentInputs.vPositionW * envPar.y;
  let envM = textureSample(envRockAlbedoSampler, envRockAlbedoSamplerSampler, envQ.zy + vec2f(0.37, 0.11)).g * envW.x
    + textureSample(envRockAlbedoSampler, envRockAlbedoSamplerSampler, envQ.xz + vec2f(0.61, 0.29)).g * envW.y
    + textureSample(envRockAlbedoSampler, envRockAlbedoSamplerSampler, envQ.xy + vec2f(0.13, 0.71)).g * envW.z;
  let envF = textureSample(envRockAlbedoSampler, envRockAlbedoSamplerSampler, fragmentInputs.vPositionW.xz * 0.023 + vec2f(0.5, 0.5)).g;
  let envWarm = mix(vec3f(0.93, 0.95, 1.0), vec3f(1.06, 1.0, 0.92), smoothstep(0.35, 0.65, envF));
  surfaceAlbedo = surfaceAlbedo * toLinearSpaceVec3(envC.rgb) * ${d} * (0.78 + 0.42 * envM) * envWarm;
  envRough = envC.a;
#ifdef VERTEXCOLOR
  envRough = mix(envRough, 0.97, clamp((fragmentInputs.vColor.g - fragmentInputs.vColor.r) * 9.0, 0.0, 1.0));
#endif
  let envS = sign(envN);
  var envTx = textureSample(envRockNormalSampler, envRockNormalSamplerSampler, envP.zy).xyz * 2.0 - 1.0;
  var envTy = textureSample(envRockNormalSampler, envRockNormalSamplerSampler, envP.xz).xyz * 2.0 - 1.0;
  var envTz = textureSample(envRockNormalSampler, envRockNormalSamplerSampler, envP.xy).xyz * 2.0 - 1.0;
  envTx = vec3f(envTx.xy * envPar.z * vec2f(envS.x, 1.0) + envN.zy, abs(envTx.z) * envN.x);
  envTy = vec3f(envTy.xy * envPar.z * vec2f(envS.y, 1.0) + envN.xz, abs(envTy.z) * envN.y);
  envTz = vec3f(envTz.xy * envPar.z * vec2f(-envS.z, 1.0) + envN.xy, abs(envTz.z) * envN.z);
  normalW = normalize(envTx.zyx * envW.x + envTy.xzy * envW.y + envTz.xyz * envW.z);
}
`,"!reflectivityBlock\\(\\s*uniforms\\.vReflectivityColor":"reflectivityBlock(vec4f(uniforms.vReflectivityColor.x, envRough, uniforms.vReflectivityColor.z, uniforms.vReflectivityColor.w)"}:{CUSTOM_FRAGMENT_DEFINITIONS:`
#ifdef ENVROCK
uniform sampler2D envRockAlbedoSampler;
uniform sampler2D envRockNormalSampler;
#endif
`,CUSTOM_FRAGMENT_UPDATE_ALPHA:`
float envRough = vReflectivityColor.y;
#ifdef ENVROCK
{
  vec3 envN = normalize(vNormalW);
  vec3 envW = pow(abs(envN), vec3(4.0));
  envW /= envW.x + envW.y + envW.z;
  vec3 envP = vPositionW * envRockParams.x;
  vec4 envC = texture2D(envRockAlbedoSampler, envP.zy) * envW.x + texture2D(envRockAlbedoSampler, envP.xz) * envW.y + texture2D(envRockAlbedoSampler, envP.xy) * envW.z;
  vec3 envQ = vPositionW * envRockParams.y;
  float envM = texture2D(envRockAlbedoSampler, envQ.zy + vec2(0.37, 0.11)).g * envW.x + texture2D(envRockAlbedoSampler, envQ.xz + vec2(0.61, 0.29)).g * envW.y + texture2D(envRockAlbedoSampler, envQ.xy + vec2(0.13, 0.71)).g * envW.z;
  float envF = texture2D(envRockAlbedoSampler, vPositionW.xz * 0.023 + vec2(0.5)).g;
  vec3 envWarm = mix(vec3(0.93, 0.95, 1.0), vec3(1.06, 1.0, 0.92), smoothstep(0.35, 0.65, envF));
  surfaceAlbedo *= toLinearSpace(envC.rgb) * ${d} * (0.78 + 0.42 * envM) * envWarm;
  envRough = envC.a;
#ifdef VERTEXCOLOR
  envRough = mix(envRough, 0.97, clamp((vColor.g - vColor.r) * 9.0, 0.0, 1.0));
#endif
  vec3 envS = sign(envN);
  vec3 envTx = texture2D(envRockNormalSampler, envP.zy).xyz * 2.0 - 1.0;
  vec3 envTy = texture2D(envRockNormalSampler, envP.xz).xyz * 2.0 - 1.0;
  vec3 envTz = texture2D(envRockNormalSampler, envP.xy).xyz * 2.0 - 1.0;
  envTx = vec3(envTx.xy * envRockParams.z * vec2(envS.x, 1.0) + envN.zy, abs(envTx.z) * envN.x);
  envTy = vec3(envTy.xy * envRockParams.z * vec2(envS.y, 1.0) + envN.xz, abs(envTy.z) * envN.y);
  envTz = vec3(envTz.xy * envRockParams.z * vec2(-envS.z, 1.0) + envN.xy, abs(envTz.z) * envN.z);
  normalW = normalize(envTx.zyx * envW.x + envTy.xzy * envW.y + envTz.xyz * envW.z);
}
#endif
`,"!reflectivityBlock\\(\\s*vReflectivityColor":"reflectivityBlock(vec4(vReflectivityColor.x, envRough, vReflectivityColor.zw)"}}}const f=new WeakMap;function g(l,e){let r=f.get(l);return r||f.set(l,r=new x(l,s[e]??s.medium)),r}function z(l,e){const r=g(e,h());for(const a of l.meshes){const n=a.material;if(!n?.name.startsWith("env."))continue;a.material=r.get(n.name,n.albedoTexture??null);const t=a.getVerticesData(b.UV2Kind);t&&a instanceof p&&a.setVerticesData(m,Float32Array.from(t),!1,2)}}class x{constructor(e,r){this.scene=e,this.tier=r,this.wind.strength=r.wind;const a=e.onBeforeRenderObservable.add(()=>{this.wind.time+=Math.min(.1,e.getEngine().getDeltaTime()/1e3)});e.onDisposeObservable.addOnce(()=>e.onBeforeRenderObservable.remove(a))}scene;tier;wind={time:0,strength:1};cache=new Map;textures=new Map;wireframe=!1;setWind(e){this.wind.strength=e}setWireframe(e){this.wireframe=e;for(const r of this.cache.values())r.wireframe=e}texture(e,r=!1){let a=this.textures.get(e);return a||(a=new y(R(`/${e}`),this.scene,!1,!1),r&&(a.gammaSpace=!1),this.textures.set(e,a)),a}get(e,r){const a=(e.startsWith("env.impostor"),e);let n=this.cache.get(a);if(n)return n;n=new c(`env_${e}`,this.scene),n.metallic=0,n.roughness=.9,n.albedoColor=S.White(),n.environmentIntensity=.6,n.maxSimultaneousLights=4,n.wireframe=this.wireframe;const t=e==="env.leaf"||e.startsWith("env.impostor");if(e==="env.bark")n.albedoTexture=this.texture(v.bark),this.tier.normals&&(n.bumpTexture=this.texture(v.barkNormal,!0)),n.roughness=.92;else if(e==="env.rock")n.roughness=.86,this.tier.normals?new W(n,this.texture(v.rock),this.texture(v.rockNormal,!0),k):n.albedoTexture=this.texture(v.rock);else if(e==="env.grass")n.backFaceCulling=!1,n.roughness=.85,n.maxSimultaneousLights=2;else if(t){const i=e==="env.leaf"?this.texture(v.leaves):r;i&&(i.hasAlpha=!0,n.albedoTexture=i),n.transparencyMode=c.PBRMATERIAL_ALPHATEST,n.alphaCutOff=.5,n.useAlphaFromAlbedoTexture=!0,n.backFaceCulling=!1,n.roughness=.8}return e!=="env.rock"&&new P(n,this.wind),this.cache.set(a,n),n}dispose(){for(const e of this.cache.values())e.dispose();for(const e of this.textures.values())e.dispose();this.cache.clear(),this.textures.clear()}}const E=Object.freeze(Object.defineProperty({__proto__:null,ENV_TIERS:s,ENV_WIND_KIND:m,EnvMaterials:x,applyEnvMaterials:z,envMaterialsFor:g},Symbol.toStringTag,{value:"Module"}));export{s as E,x as a,C as b,m as c,E as d,g as e};
