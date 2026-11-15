import { h as Mesh, i as VertexData, M as Matrix, V as Vector3 } from "./babylon-PnzH6wcM.js";
function CreateSphereVertexData(options) {
  const segments = (options.segments || 32) | 0;
  const diameterX = options.diameterX || options.diameter || 1;
  const diameterY = options.diameterY || options.diameter || 1;
  const diameterZ = options.diameterZ || options.diameter || 1;
  const arc = options.arc && (options.arc <= 0 || options.arc > 1) ? 1 : options.arc || 1;
  const slice = options.slice && options.slice <= 0 ? 1 : options.slice || 1;
  const sideOrientation = options.sideOrientation === 0 ? 0 : options.sideOrientation || VertexData.DEFAULTSIDE;
  const dedupTopBottomIndices = !!options.dedupTopBottomIndices;
  const radius = new Vector3(diameterX / 2, diameterY / 2, diameterZ / 2);
  const totalZRotationSteps = 2 + segments;
  const totalYRotationSteps = 2 * totalZRotationSteps;
  const indices = [];
  const positions = [];
  const normals = [];
  const uvs = [];
  for (let zRotationStep = 0; zRotationStep <= totalZRotationSteps; zRotationStep++) {
    const normalizedZ = zRotationStep / totalZRotationSteps;
    const angleZ = normalizedZ * Math.PI * slice;
    for (let yRotationStep = 0; yRotationStep <= totalYRotationSteps; yRotationStep++) {
      const normalizedY = yRotationStep / totalYRotationSteps;
      const angleY = normalizedY * Math.PI * 2 * arc;
      const rotationZ = Matrix.RotationZ(-angleZ);
      const rotationY = Matrix.RotationY(angleY);
      const afterRotZ = Vector3.TransformCoordinates(Vector3.Up(), rotationZ);
      const complete = Vector3.TransformCoordinates(afterRotZ, rotationY);
      const vertex = complete.multiply(radius);
      const normal = complete.divide(radius).normalize();
      positions.push(vertex.x, vertex.y, vertex.z);
      normals.push(normal.x, normal.y, normal.z);
      uvs.push(normalizedY, normalizedZ);
    }
    if (zRotationStep > 0) {
      const verticesCount = positions.length / 3;
      for (let firstIndex = verticesCount - 2 * (totalYRotationSteps + 1); firstIndex + totalYRotationSteps + 2 < verticesCount; firstIndex++) {
        if (dedupTopBottomIndices) {
          if (zRotationStep > 1) {
            indices.push(firstIndex);
            indices.push(firstIndex + 1);
            indices.push(firstIndex + totalYRotationSteps + 1);
          }
          if (zRotationStep < totalZRotationSteps || slice < 1) {
            indices.push(firstIndex + totalYRotationSteps + 1);
            indices.push(firstIndex + 1);
            indices.push(firstIndex + totalYRotationSteps + 2);
          }
        } else {
          indices.push(firstIndex);
          indices.push(firstIndex + 1);
          indices.push(firstIndex + totalYRotationSteps + 1);
          indices.push(firstIndex + totalYRotationSteps + 1);
          indices.push(firstIndex + 1);
          indices.push(firstIndex + totalYRotationSteps + 2);
        }
      }
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
function CreateSphere(name, options = {}, scene = null) {
  const sphere = new Mesh(name, scene);
  options.sideOrientation = Mesh._GetDefaultSideOrientation(options.sideOrientation);
  sphere._originalBuilderSideOrientation = options.sideOrientation;
  const vertexData = CreateSphereVertexData(options);
  vertexData.applyToMesh(sphere, options.updatable);
  return sphere;
}
let _Registered = false;
function RegisterSphereBuilder() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  VertexData.CreateSphere = CreateSphereVertexData;
  Mesh.CreateSphere = (name, segments, diameter, scene, updatable, sideOrientation) => {
    const options = {
      segments,
      diameterX: diameter,
      diameterY: diameter,
      diameterZ: diameter,
      sideOrientation,
      updatable
    };
    return CreateSphere(name, options, scene);
  };
}
export {
  CreateSphere as C,
  RegisterSphereBuilder as R,
  CreateSphereVertexData as a
};
