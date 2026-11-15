import { h as Mesh, i as VertexData, C as Color4, a1 as Vector4, V as Vector3, aE as Axis, a0 as Vector2, S as Scene } from "./babylon-PnzH6wcM.js";
function CreateCylinderVertexData(options) {
  const height = options.height || 2;
  let diameterTop = options.diameterTop === 0 ? 0 : options.diameterTop || options.diameter || 1;
  let diameterBottom = options.diameterBottom === 0 ? 0 : options.diameterBottom || options.diameter || 1;
  diameterTop = diameterTop || 1e-5;
  diameterBottom = diameterBottom || 1e-5;
  const tessellation = (options.tessellation || 24) | 0;
  const subdivisions = (options.subdivisions || 1) | 0;
  const hasRings = options.hasRings ? true : false;
  const enclose = options.enclose ? true : false;
  const cap = options.cap === 0 ? 0 : options.cap || Mesh.CAP_ALL;
  const arc = options.arc && (options.arc <= 0 || options.arc > 1) ? 1 : options.arc || 1;
  const sideOrientation = options.sideOrientation === 0 ? 0 : options.sideOrientation || VertexData.DEFAULTSIDE;
  const faceUV = options.faceUV || new Array(3);
  const faceColors = options.faceColors;
  const quadNb = arc !== 1 && enclose ? 2 : 0;
  const ringNb = hasRings ? subdivisions : 1;
  const surfaceNb = 2 + (1 + quadNb) * ringNb;
  let f;
  for (f = 0; f < surfaceNb; f++) {
    if (faceColors && faceColors[f] === void 0) {
      faceColors[f] = new Color4(1, 1, 1, 1);
    }
  }
  for (f = 0; f < surfaceNb; f++) {
    if (faceUV && faceUV[f] === void 0) {
      faceUV[f] = new Vector4(0, 0, 1, 1);
    }
  }
  const indices = [];
  const positions = [];
  const normals = [];
  const uvs = [];
  const colors = [];
  const angleStep = Math.PI * 2 * arc / tessellation;
  let angle;
  let h;
  let radius;
  const tan = (diameterBottom - diameterTop) / 2 / height;
  const ringVertex = Vector3.Zero();
  const ringNormal = Vector3.Zero();
  const ringFirstVertex = Vector3.Zero();
  const ringFirstNormal = Vector3.Zero();
  const quadNormal = Vector3.Zero();
  const y = Axis.Y;
  let i;
  let j;
  let r;
  let ringIdx;
  let s = 1;
  let cs = 0;
  let v;
  for (i = 0; i <= subdivisions; i++) {
    h = i / subdivisions;
    radius = (h * (diameterTop - diameterBottom) + diameterBottom) / 2;
    ringIdx = hasRings && i !== 0 && i !== subdivisions ? 2 : 1;
    for (r = 0; r < ringIdx; r++) {
      if (hasRings) {
        s += r;
      }
      if (enclose) {
        s += 2 * r;
      }
      for (j = 0; j <= tessellation; j++) {
        angle = j * angleStep;
        ringVertex.x = Math.cos(-angle) * radius;
        ringVertex.y = -height / 2 + h * height;
        ringVertex.z = Math.sin(-angle) * radius;
        if (diameterTop === 0 && i === subdivisions) {
          ringNormal.x = normals[normals.length - (tessellation + 1) * 3];
          ringNormal.y = normals[normals.length - (tessellation + 1) * 3 + 1];
          ringNormal.z = normals[normals.length - (tessellation + 1) * 3 + 2];
        } else {
          ringNormal.x = ringVertex.x;
          ringNormal.z = ringVertex.z;
          ringNormal.y = Math.sqrt(ringNormal.x * ringNormal.x + ringNormal.z * ringNormal.z) * tan;
          ringNormal.normalize();
        }
        if (j === 0) {
          ringFirstVertex.copyFrom(ringVertex);
          ringFirstNormal.copyFrom(ringNormal);
        }
        positions.push(ringVertex.x, ringVertex.y, ringVertex.z);
        normals.push(ringNormal.x, ringNormal.y, ringNormal.z);
        if (hasRings) {
          v = cs !== s ? faceUV[s].y : faceUV[s].w;
        } else {
          v = faceUV[s].y + (faceUV[s].w - faceUV[s].y) * h;
        }
        uvs.push(faceUV[s].x + (faceUV[s].z - faceUV[s].x) * j / tessellation, v);
        if (faceColors) {
          colors.push(faceColors[s].r, faceColors[s].g, faceColors[s].b, faceColors[s].a);
        }
      }
      if (arc !== 1 && enclose) {
        positions.push(ringVertex.x, ringVertex.y, ringVertex.z);
        positions.push(0, ringVertex.y, 0);
        positions.push(0, ringVertex.y, 0);
        positions.push(ringFirstVertex.x, ringFirstVertex.y, ringFirstVertex.z);
        Vector3.CrossToRef(y, ringNormal, quadNormal);
        quadNormal.normalize();
        normals.push(quadNormal.x, quadNormal.y, quadNormal.z, quadNormal.x, quadNormal.y, quadNormal.z);
        Vector3.CrossToRef(ringFirstNormal, y, quadNormal);
        quadNormal.normalize();
        normals.push(quadNormal.x, quadNormal.y, quadNormal.z, quadNormal.x, quadNormal.y, quadNormal.z);
        if (hasRings) {
          v = cs !== s ? faceUV[s + 1].y : faceUV[s + 1].w;
        } else {
          v = faceUV[s + 1].y + (faceUV[s + 1].w - faceUV[s + 1].y) * h;
        }
        uvs.push(faceUV[s + 1].x, v);
        uvs.push(faceUV[s + 1].z, v);
        if (hasRings) {
          v = cs !== s ? faceUV[s + 2].y : faceUV[s + 2].w;
        } else {
          v = faceUV[s + 2].y + (faceUV[s + 2].w - faceUV[s + 2].y) * h;
        }
        uvs.push(faceUV[s + 2].x, v);
        uvs.push(faceUV[s + 2].z, v);
        if (faceColors) {
          colors.push(faceColors[s + 1].r, faceColors[s + 1].g, faceColors[s + 1].b, faceColors[s + 1].a);
          colors.push(faceColors[s + 1].r, faceColors[s + 1].g, faceColors[s + 1].b, faceColors[s + 1].a);
          colors.push(faceColors[s + 2].r, faceColors[s + 2].g, faceColors[s + 2].b, faceColors[s + 2].a);
          colors.push(faceColors[s + 2].r, faceColors[s + 2].g, faceColors[s + 2].b, faceColors[s + 2].a);
        }
      }
      if (cs !== s) {
        cs = s;
      }
    }
  }
  const e = arc !== 1 && enclose ? tessellation + 4 : tessellation;
  i = 0;
  for (s = 0; s < subdivisions; s++) {
    let i0 = 0;
    let i1 = 0;
    let i2 = 0;
    let i3 = 0;
    for (j = 0; j < tessellation; j++) {
      i0 = i * (e + 1) + j;
      i1 = (i + 1) * (e + 1) + j;
      i2 = i * (e + 1) + (j + 1);
      i3 = (i + 1) * (e + 1) + (j + 1);
      indices.push(i0, i1, i2);
      indices.push(i3, i2, i1);
    }
    if (arc !== 1 && enclose) {
      indices.push(i0 + 2, i1 + 2, i2 + 2);
      indices.push(i3 + 2, i2 + 2, i1 + 2);
      indices.push(i0 + 4, i1 + 4, i2 + 4);
      indices.push(i3 + 4, i2 + 4, i1 + 4);
    }
    i = hasRings ? i + 2 : i + 1;
  }
  const createCylinderCap = (isTop) => {
    const radius2 = isTop ? diameterTop / 2 : diameterBottom / 2;
    if (radius2 === 0) {
      return;
    }
    let angle2;
    let circleVector;
    let i2;
    const u = isTop ? faceUV[surfaceNb - 1] : faceUV[0];
    let c = null;
    if (faceColors) {
      c = isTop ? faceColors[surfaceNb - 1] : faceColors[0];
    }
    const vbase = positions.length / 3;
    const offset = isTop ? height / 2 : -height / 2;
    const center = new Vector3(0, offset, 0);
    positions.push(center.x, center.y, center.z);
    normals.push(0, isTop ? 1 : -1, 0);
    const v2 = u.y + (u.w - u.y) * 0.5;
    uvs.push(u.x + (u.z - u.x) * 0.5, v2);
    if (c) {
      colors.push(c.r, c.g, c.b, c.a);
    }
    const textureScale = new Vector2(0.5, 0.5);
    for (i2 = 0; i2 <= tessellation; i2++) {
      angle2 = Math.PI * 2 * i2 * arc / tessellation;
      const cos = Math.cos(-angle2);
      const sin = Math.sin(-angle2);
      circleVector = new Vector3(cos * radius2, offset, sin * radius2);
      const textureCoordinate = new Vector2(cos * textureScale.x + 0.5, sin * textureScale.y + 0.5);
      positions.push(circleVector.x, circleVector.y, circleVector.z);
      normals.push(0, isTop ? 1 : -1, 0);
      const v3 = u.y + (u.w - u.y) * textureCoordinate.y;
      uvs.push(u.x + (u.z - u.x) * textureCoordinate.x, v3);
      if (c) {
        colors.push(c.r, c.g, c.b, c.a);
      }
    }
    for (i2 = 0; i2 < tessellation; i2++) {
      if (!isTop) {
        indices.push(vbase);
        indices.push(vbase + (i2 + 1));
        indices.push(vbase + (i2 + 2));
      } else {
        indices.push(vbase);
        indices.push(vbase + (i2 + 2));
        indices.push(vbase + (i2 + 1));
      }
    }
  };
  if (cap === Mesh.CAP_START || cap === Mesh.CAP_ALL) {
    createCylinderCap(false);
  }
  if (cap === Mesh.CAP_END || cap === Mesh.CAP_ALL) {
    createCylinderCap(true);
  }
  VertexData._ComputeSides(sideOrientation, positions, indices, normals, uvs, options.frontUVs, options.backUVs);
  const vertexData = new VertexData();
  vertexData.indices = indices;
  vertexData.positions = positions;
  vertexData.normals = normals;
  vertexData.uvs = uvs;
  if (faceColors) {
    vertexData.colors = colors;
  }
  return vertexData;
}
function CreateCylinder(name, options = {}, scene) {
  const cylinder = new Mesh(name, scene);
  options.sideOrientation = Mesh._GetDefaultSideOrientation(options.sideOrientation);
  cylinder._originalBuilderSideOrientation = options.sideOrientation;
  const vertexData = CreateCylinderVertexData(options);
  vertexData.applyToMesh(cylinder, options.updatable);
  return cylinder;
}
let _Registered = false;
function RegisterCylinderBuilder() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  VertexData.CreateCylinder = CreateCylinderVertexData;
  Mesh.CreateCylinder = (name, height, diameterTop, diameterBottom, tessellation, subdivisions, scene, updatable, sideOrientation) => {
    if (scene === void 0 || !(scene instanceof Scene)) {
      if (scene !== void 0) {
        sideOrientation = updatable || Mesh.DEFAULTSIDE;
        updatable = scene;
      }
      scene = subdivisions;
      subdivisions = 1;
    }
    const options = {
      height,
      diameterTop,
      diameterBottom,
      tessellation,
      subdivisions,
      sideOrientation,
      updatable
    };
    return CreateCylinder(name, options, scene);
  };
}
RegisterCylinderBuilder();
export {
  CreateCylinder as C,
  CreateCylinderVertexData as a
};
