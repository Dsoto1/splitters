import { h as Mesh, i as VertexData, M as Matrix, V as Vector3, a0 as Vector2 } from "./babylon-PnzH6wcM.js";
function CreateTorusVertexData(options) {
  const indices = [];
  const positions = [];
  const normals = [];
  const uvs = [];
  const diameter = options.diameter || 1;
  const thickness = options.thickness || 0.5;
  const tessellation = (options.tessellation || 16) | 0;
  const sideOrientation = options.sideOrientation === 0 ? 0 : options.sideOrientation || VertexData.DEFAULTSIDE;
  const stride = tessellation + 1;
  for (let i = 0; i <= tessellation; i++) {
    const u = i / tessellation;
    const outerAngle = i * Math.PI * 2 / tessellation - Math.PI / 2;
    const transform = Matrix.Translation(diameter / 2, 0, 0).multiply(Matrix.RotationY(outerAngle));
    for (let j = 0; j <= tessellation; j++) {
      const v = 1 - j / tessellation;
      const innerAngle = j * Math.PI * 2 / tessellation + Math.PI;
      const dx = Math.cos(innerAngle);
      const dy = Math.sin(innerAngle);
      let normal = new Vector3(dx, dy, 0);
      let position = normal.scale(thickness / 2);
      const textureCoordinate = new Vector2(u, v);
      position = Vector3.TransformCoordinates(position, transform);
      normal = Vector3.TransformNormal(normal, transform);
      positions.push(position.x, position.y, position.z);
      normals.push(normal.x, normal.y, normal.z);
      uvs.push(textureCoordinate.x, textureCoordinate.y);
      const nextI = (i + 1) % stride;
      const nextJ = (j + 1) % stride;
      indices.push(i * stride + j);
      indices.push(i * stride + nextJ);
      indices.push(nextI * stride + j);
      indices.push(i * stride + nextJ);
      indices.push(nextI * stride + nextJ);
      indices.push(nextI * stride + j);
    }
  }
  VertexData._ComputeSides(sideOrientation, positions, indices, normals, uvs, options.frontUVs, options.backUVs);
  const vertexData = new VertexData();
  vertexData.indices = indices;
  vertexData.positions = positions;
  vertexData.normals = normals;
  vertexData.uvs = uvs;
  return vertexData;
}
function CreateTorus(name, options = {}, scene) {
  const torus = new Mesh(name, scene);
  options.sideOrientation = Mesh._GetDefaultSideOrientation(options.sideOrientation);
  torus._originalBuilderSideOrientation = options.sideOrientation;
  const vertexData = CreateTorusVertexData(options);
  vertexData.applyToMesh(torus, options.updatable);
  return torus;
}
let _Registered = false;
function RegisterTorusBuilder() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  VertexData.CreateTorus = CreateTorusVertexData;
  Mesh.CreateTorus = (name, diameter, thickness, tessellation, scene, updatable, sideOrientation) => {
    const options = {
      diameter,
      thickness,
      tessellation,
      sideOrientation,
      updatable
    };
    return CreateTorus(name, options, scene);
  };
}
RegisterTorusBuilder();
export {
  CreateTorus as C,
  CreateTorusVertexData as a
};
