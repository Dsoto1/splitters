import { R as RegisterSphereBuilder } from "./sphereBuilder.pure-CT5peVwp.js";
import { h as Mesh, V as Vector3, a0 as Vector2, M as Matrix, i as VertexData } from "./babylon-PnzH6wcM.js";
RegisterSphereBuilder();
function CreateCapsuleVertexData(options = {
  subdivisions: 2,
  tessellation: 16,
  height: 1,
  radius: 0.25,
  capSubdivisions: 6
}) {
  const subdivisions = Math.max(options.subdivisions ? options.subdivisions : 2, 1) | 0;
  const tessellation = Math.max(options.tessellation ? options.tessellation : 16, 3) | 0;
  const height = Math.max(options.height ? options.height : 1, 0);
  const radius = Math.max(options.radius ? options.radius : 0.25, 0);
  const capDetail = Math.max(options.capSubdivisions ? options.capSubdivisions : 6, 1) | 0;
  const radialSegments = tessellation;
  const heightSegments = subdivisions;
  const radiusTop = Math.max(options.radiusTop ? options.radiusTop : radius, 0);
  const radiusBottom = Math.max(options.radiusBottom ? options.radiusBottom : radius, 0);
  const heightMinusCaps = height - (radiusTop + radiusBottom);
  const thetaStart = 0;
  const thetaLength = 2 * Math.PI;
  const capsTopSegments = Math.max(options.topCapSubdivisions ? options.topCapSubdivisions : capDetail, 1);
  const capsBottomSegments = Math.max(options.bottomCapSubdivisions ? options.bottomCapSubdivisions : capDetail, 1);
  const alpha = Math.acos((radiusBottom - radiusTop) / height);
  let indices = [];
  const vertices = [];
  const normals = [];
  const uvs = [];
  let index = 0;
  const indexArray = [], halfHeight = heightMinusCaps * 0.5;
  const pi2 = Math.PI * 0.5;
  let x, y;
  const normal = Vector3.Zero();
  const vertex = Vector3.Zero();
  const cosAlpha = Math.cos(alpha);
  const sinAlpha = Math.sin(alpha);
  const coneLength = new Vector2(radiusTop * sinAlpha, halfHeight + radiusTop * cosAlpha).subtract(new Vector2(radiusBottom * sinAlpha, -halfHeight + radiusBottom * cosAlpha)).length();
  const vl = radiusTop * alpha + coneLength + radiusBottom * (pi2 - alpha);
  let v = 0;
  for (y = 0; y <= capsTopSegments; y++) {
    const indexRow = [];
    const a = pi2 - alpha * (y / capsTopSegments);
    v += radiusTop * alpha / capsTopSegments;
    const cosA = Math.cos(a);
    const sinA = Math.sin(a);
    const _radius = cosA * radiusTop;
    for (x = 0; x <= radialSegments; x++) {
      const u = x / radialSegments;
      const theta = u * thetaLength + thetaStart;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);
      vertex.x = _radius * sinTheta;
      vertex.y = halfHeight + sinA * radiusTop;
      vertex.z = _radius * cosTheta;
      vertices.push(vertex.x, vertex.y, vertex.z);
      normal.set(cosA * sinTheta, sinA, cosA * cosTheta);
      normals.push(normal.x, normal.y, normal.z);
      uvs.push(u, 1 - v / vl);
      indexRow.push(index);
      index++;
    }
    indexArray.push(indexRow);
  }
  const coneHeight = height - radiusTop - radiusBottom + cosAlpha * radiusTop - cosAlpha * radiusBottom;
  const slope = sinAlpha * (radiusBottom - radiusTop) / coneHeight;
  for (y = 1; y <= heightSegments; y++) {
    const indexRow = [];
    v += coneLength / heightSegments;
    const _radius = sinAlpha * (y * (radiusBottom - radiusTop) / heightSegments + radiusTop);
    for (x = 0; x <= radialSegments; x++) {
      const u = x / radialSegments;
      const theta = u * thetaLength + thetaStart;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);
      vertex.x = _radius * sinTheta;
      vertex.y = halfHeight + cosAlpha * radiusTop - y * coneHeight / heightSegments;
      vertex.z = _radius * cosTheta;
      vertices.push(vertex.x, vertex.y, vertex.z);
      normal.set(sinTheta, slope, cosTheta).normalize();
      normals.push(normal.x, normal.y, normal.z);
      uvs.push(u, 1 - v / vl);
      indexRow.push(index);
      index++;
    }
    indexArray.push(indexRow);
  }
  for (y = 1; y <= capsBottomSegments; y++) {
    const indexRow = [];
    const a = pi2 - alpha - (Math.PI - alpha) * (y / capsBottomSegments);
    v += radiusBottom * alpha / capsBottomSegments;
    const cosA = Math.cos(a);
    const sinA = Math.sin(a);
    const _radius = cosA * radiusBottom;
    for (x = 0; x <= radialSegments; x++) {
      const u = x / radialSegments;
      const theta = u * thetaLength + thetaStart;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);
      vertex.x = _radius * sinTheta;
      vertex.y = -halfHeight + sinA * radiusBottom;
      vertex.z = _radius * cosTheta;
      vertices.push(vertex.x, vertex.y, vertex.z);
      normal.set(cosA * sinTheta, sinA, cosA * cosTheta);
      normals.push(normal.x, normal.y, normal.z);
      uvs.push(u, 1 - v / vl);
      indexRow.push(index);
      index++;
    }
    indexArray.push(indexRow);
  }
  for (x = 0; x < radialSegments; x++) {
    for (y = 0; y < capsTopSegments + heightSegments + capsBottomSegments; y++) {
      const i1 = indexArray[y][x];
      const i2 = indexArray[y + 1][x];
      const i3 = indexArray[y + 1][x + 1];
      const i4 = indexArray[y][x + 1];
      indices.push(i1);
      indices.push(i2);
      indices.push(i4);
      indices.push(i2);
      indices.push(i3);
      indices.push(i4);
    }
  }
  indices = indices.reverse();
  if (options.orientation && !options.orientation.equals(Vector3.Up())) {
    const m = new Matrix();
    options.orientation.clone().scale(Math.PI * 0.5).cross(Vector3.Up()).toQuaternion().toRotationMatrix(m);
    const v2 = Vector3.Zero();
    for (let i = 0; i < vertices.length; i += 3) {
      v2.set(vertices[i], vertices[i + 1], vertices[i + 2]);
      Vector3.TransformCoordinatesToRef(v2.clone(), m, v2);
      vertices[i] = v2.x;
      vertices[i + 1] = v2.y;
      vertices[i + 2] = v2.z;
    }
  }
  const vDat = new VertexData();
  vDat.positions = vertices;
  vDat.normals = normals;
  vDat.uvs = uvs;
  vDat.indices = indices;
  return vDat;
}
function CreateCapsule(name, options = {
  orientation: Vector3.Up(),
  subdivisions: 2,
  tessellation: 16,
  height: 1,
  radius: 0.25,
  capSubdivisions: 6,
  updatable: false
}, scene = null) {
  const capsule = new Mesh(name, scene);
  const vertexData = CreateCapsuleVertexData(options);
  vertexData.applyToMesh(capsule, options.updatable);
  return capsule;
}
let _Registered = false;
function RegisterCapsuleBuilder() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  Mesh.CreateCapsule = (name, options, scene) => {
    return CreateCapsule(name, options, scene);
  };
  VertexData.CreateCapsule = CreateCapsuleVertexData;
}
RegisterCapsuleBuilder();
export {
  CreateCapsule as C,
  CreateCapsuleVertexData as a
};
