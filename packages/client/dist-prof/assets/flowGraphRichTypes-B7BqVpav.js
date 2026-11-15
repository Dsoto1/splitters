import { V as Vector3, a0 as Vector2, Q as Quaternion, Y as FlowGraphInteger, C as Color4, a as Color3, M as Matrix, a1 as Vector4 } from "./babylon-PnzH6wcM.js";
class FlowGraphMatrix2D {
  constructor(m = [1, 0, 0, 1]) {
    this._m = m;
  }
  /**
   * Creates an independent copy of this matrix.
   * @returns a new matrix with copied column-major elements
   */
  clone() {
    return new FlowGraphMatrix2D(this._m.slice());
  }
  get m() {
    return this._m;
  }
  transformVector(v) {
    return this.transformVectorToRef(v, new Vector2());
  }
  transformVectorToRef(v, result) {
    result.x = v.x * this._m[0] + v.y * this._m[2];
    result.y = v.x * this._m[1] + v.y * this._m[3];
    return result;
  }
  asArray() {
    return this.toArray();
  }
  toArray(emptyArray = []) {
    for (let i = 0; i < 4; i++) {
      emptyArray[i] = this._m[i];
    }
    return emptyArray;
  }
  fromArray(array) {
    for (let i = 0; i < 4; i++) {
      this._m[i] = array[i];
    }
    return this;
  }
  multiplyToRef(other, result) {
    const otherMatrix = other._m;
    const thisMatrix = this._m;
    const r = result._m;
    r[0] = thisMatrix[0] * otherMatrix[0] + thisMatrix[1] * otherMatrix[2];
    r[1] = thisMatrix[0] * otherMatrix[1] + thisMatrix[1] * otherMatrix[3];
    r[2] = thisMatrix[2] * otherMatrix[0] + thisMatrix[3] * otherMatrix[2];
    r[3] = thisMatrix[2] * otherMatrix[1] + thisMatrix[3] * otherMatrix[3];
    return result;
  }
  multiply(other) {
    return this.multiplyToRef(other, new FlowGraphMatrix2D());
  }
  divideToRef(other, result) {
    const m = this._m;
    const o = other._m;
    const r = result._m;
    r[0] = m[0] / o[0];
    r[1] = m[1] / o[1];
    r[2] = m[2] / o[2];
    r[3] = m[3] / o[3];
    return result;
  }
  divide(other) {
    return this.divideToRef(other, new FlowGraphMatrix2D());
  }
  addToRef(other, result) {
    const m = this._m;
    const o = other.m;
    const r = result.m;
    r[0] = m[0] + o[0];
    r[1] = m[1] + o[1];
    r[2] = m[2] + o[2];
    r[3] = m[3] + o[3];
    return result;
  }
  add(other) {
    return this.addToRef(other, new FlowGraphMatrix2D());
  }
  subtractToRef(other, result) {
    const m = this._m;
    const o = other.m;
    const r = result.m;
    r[0] = m[0] - o[0];
    r[1] = m[1] - o[1];
    r[2] = m[2] - o[2];
    r[3] = m[3] - o[3];
    return result;
  }
  subtract(other) {
    return this.subtractToRef(other, new FlowGraphMatrix2D());
  }
  transpose() {
    const m = this._m;
    return new FlowGraphMatrix2D([m[0], m[2], m[1], m[3]]);
  }
  determinant() {
    const m = this._m;
    return m[0] * m[3] - m[1] * m[2];
  }
  inverse() {
    const det = this.determinant();
    if (det === 0) {
      throw new Error("Matrix is not invertible");
    }
    const m = this._m;
    const invDet = 1 / det;
    return new FlowGraphMatrix2D([m[3] * invDet, -m[1] * invDet, -m[2] * invDet, m[0] * invDet]);
  }
  equals(other, epsilon = 0) {
    const m = this._m;
    const o = other.m;
    if (epsilon === 0) {
      return m[0] === o[0] && m[1] === o[1] && m[2] === o[2] && m[3] === o[3];
    }
    return Math.abs(m[0] - o[0]) < epsilon && Math.abs(m[1] - o[1]) < epsilon && Math.abs(m[2] - o[2]) < epsilon && Math.abs(m[3] - o[3]) < epsilon;
  }
  getClassName() {
    return "FlowGraphMatrix2D";
  }
  toString() {
    return `FlowGraphMatrix2D(${this._m.join(", ")})`;
  }
}
class FlowGraphMatrix3D {
  constructor(array = [1, 0, 0, 0, 1, 0, 0, 0, 1]) {
    this._m = array;
  }
  /**
   * Creates an independent copy of this matrix.
   * @returns a new matrix with copied column-major elements
   */
  clone() {
    return new FlowGraphMatrix3D(this._m.slice());
  }
  get m() {
    return this._m;
  }
  transformVector(v) {
    return this.transformVectorToRef(v, new Vector3());
  }
  transformVectorToRef(v, result) {
    const m = this._m;
    result.x = v.x * m[0] + v.y * m[3] + v.z * m[6];
    result.y = v.x * m[1] + v.y * m[4] + v.z * m[7];
    result.z = v.x * m[2] + v.y * m[5] + v.z * m[8];
    return result;
  }
  multiplyToRef(other, result) {
    const otherMatrix = other._m;
    const thisMatrix = this._m;
    const r = result.m;
    r[0] = thisMatrix[0] * otherMatrix[0] + thisMatrix[1] * otherMatrix[3] + thisMatrix[2] * otherMatrix[6];
    r[1] = thisMatrix[0] * otherMatrix[1] + thisMatrix[1] * otherMatrix[4] + thisMatrix[2] * otherMatrix[7];
    r[2] = thisMatrix[0] * otherMatrix[2] + thisMatrix[1] * otherMatrix[5] + thisMatrix[2] * otherMatrix[8];
    r[3] = thisMatrix[3] * otherMatrix[0] + thisMatrix[4] * otherMatrix[3] + thisMatrix[5] * otherMatrix[6];
    r[4] = thisMatrix[3] * otherMatrix[1] + thisMatrix[4] * otherMatrix[4] + thisMatrix[5] * otherMatrix[7];
    r[5] = thisMatrix[3] * otherMatrix[2] + thisMatrix[4] * otherMatrix[5] + thisMatrix[5] * otherMatrix[8];
    r[6] = thisMatrix[6] * otherMatrix[0] + thisMatrix[7] * otherMatrix[3] + thisMatrix[8] * otherMatrix[6];
    r[7] = thisMatrix[6] * otherMatrix[1] + thisMatrix[7] * otherMatrix[4] + thisMatrix[8] * otherMatrix[7];
    r[8] = thisMatrix[6] * otherMatrix[2] + thisMatrix[7] * otherMatrix[5] + thisMatrix[8] * otherMatrix[8];
    return result;
  }
  multiply(other) {
    return this.multiplyToRef(other, new FlowGraphMatrix3D());
  }
  divideToRef(other, result) {
    const m = this._m;
    const o = other.m;
    const r = result.m;
    r[0] = m[0] / o[0];
    r[1] = m[1] / o[1];
    r[2] = m[2] / o[2];
    r[3] = m[3] / o[3];
    r[4] = m[4] / o[4];
    r[5] = m[5] / o[5];
    r[6] = m[6] / o[6];
    r[7] = m[7] / o[7];
    r[8] = m[8] / o[8];
    return result;
  }
  divide(other) {
    return this.divideToRef(other, new FlowGraphMatrix3D());
  }
  addToRef(other, result) {
    const m = this._m;
    const o = other.m;
    const r = result.m;
    r[0] = m[0] + o[0];
    r[1] = m[1] + o[1];
    r[2] = m[2] + o[2];
    r[3] = m[3] + o[3];
    r[4] = m[4] + o[4];
    r[5] = m[5] + o[5];
    r[6] = m[6] + o[6];
    r[7] = m[7] + o[7];
    r[8] = m[8] + o[8];
    return result;
  }
  add(other) {
    return this.addToRef(other, new FlowGraphMatrix3D());
  }
  subtractToRef(other, result) {
    const m = this._m;
    const o = other.m;
    const r = result.m;
    r[0] = m[0] - o[0];
    r[1] = m[1] - o[1];
    r[2] = m[2] - o[2];
    r[3] = m[3] - o[3];
    r[4] = m[4] - o[4];
    r[5] = m[5] - o[5];
    r[6] = m[6] - o[6];
    r[7] = m[7] - o[7];
    r[8] = m[8] - o[8];
    return result;
  }
  subtract(other) {
    return this.subtractToRef(other, new FlowGraphMatrix3D());
  }
  toArray(emptyArray = []) {
    for (let i = 0; i < 9; i++) {
      emptyArray[i] = this._m[i];
    }
    return emptyArray;
  }
  asArray() {
    return this.toArray();
  }
  fromArray(array) {
    for (let i = 0; i < 9; i++) {
      this._m[i] = array[i];
    }
    return this;
  }
  transpose() {
    const m = this._m;
    return new FlowGraphMatrix3D([m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]);
  }
  determinant() {
    const m = this._m;
    return m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
  }
  inverse() {
    const det = this.determinant();
    if (det === 0) {
      throw new Error("Matrix is not invertible");
    }
    const m = this._m;
    const invDet = 1 / det;
    return new FlowGraphMatrix3D([
      (m[4] * m[8] - m[5] * m[7]) * invDet,
      (m[2] * m[7] - m[1] * m[8]) * invDet,
      (m[1] * m[5] - m[2] * m[4]) * invDet,
      (m[5] * m[6] - m[3] * m[8]) * invDet,
      (m[0] * m[8] - m[2] * m[6]) * invDet,
      (m[2] * m[3] - m[0] * m[5]) * invDet,
      (m[3] * m[7] - m[4] * m[6]) * invDet,
      (m[1] * m[6] - m[0] * m[7]) * invDet,
      (m[0] * m[4] - m[1] * m[3]) * invDet
    ]);
  }
  equals(other, epsilon = 0) {
    const m = this._m;
    const o = other.m;
    if (epsilon === 0) {
      return m[0] === o[0] && m[1] === o[1] && m[2] === o[2] && m[3] === o[3] && m[4] === o[4] && m[5] === o[5] && m[6] === o[6] && m[7] === o[7] && m[8] === o[8];
    }
    return Math.abs(m[0] - o[0]) < epsilon && Math.abs(m[1] - o[1]) < epsilon && Math.abs(m[2] - o[2]) < epsilon && Math.abs(m[3] - o[3]) < epsilon && Math.abs(m[4] - o[4]) < epsilon && Math.abs(m[5] - o[5]) < epsilon && Math.abs(m[6] - o[6]) < epsilon && Math.abs(m[7] - o[7]) < epsilon && Math.abs(m[8] - o[8]) < epsilon;
  }
  getClassName() {
    return "FlowGraphMatrix3D";
  }
  toString() {
    return `FlowGraphMatrix3D(${this._m.join(", ")})`;
  }
}
var FlowGraphTypes;
(function(FlowGraphTypes2) {
  FlowGraphTypes2["Any"] = "any";
  FlowGraphTypes2["String"] = "string";
  FlowGraphTypes2["Number"] = "number";
  FlowGraphTypes2["Boolean"] = "boolean";
  FlowGraphTypes2["Object"] = "object";
  FlowGraphTypes2["Integer"] = "FlowGraphInteger";
  FlowGraphTypes2["Vector2"] = "Vector2";
  FlowGraphTypes2["Vector3"] = "Vector3";
  FlowGraphTypes2["Vector4"] = "Vector4";
  FlowGraphTypes2["Quaternion"] = "Quaternion";
  FlowGraphTypes2["Matrix"] = "Matrix";
  FlowGraphTypes2["Matrix2D"] = "Matrix2D";
  FlowGraphTypes2["Matrix3D"] = "Matrix3D";
  FlowGraphTypes2["Color3"] = "Color3";
  FlowGraphTypes2["Color4"] = "Color4";
})(FlowGraphTypes || (FlowGraphTypes = {}));
class RichType {
  constructor(typeName, defaultValue, animationType = -1) {
    this.typeName = typeName;
    this.defaultValue = defaultValue;
    this.animationType = animationType;
  }
  /**
   * Serializes this rich type into a serialization object.
   * @param serializationObject the object to serialize to
   */
  serialize(serializationObject) {
    serializationObject.typeName = this.typeName;
    serializationObject.defaultValue = this.defaultValue;
  }
}
const RichTypeAny = new RichType("any", void 0);
const RichTypeString = new RichType("string", "");
const RichTypeNumber = new RichType("number", 0, 0);
const RichTypeBoolean = new RichType("boolean", false);
const RichTypeVector2 = new RichType("Vector2", Vector2.Zero(), 5);
const RichTypeVector3 = new RichType("Vector3", Vector3.Zero(), 1);
const RichTypeVector4 = new RichType("Vector4", Vector4.Zero());
const RichTypeMatrix = new RichType("Matrix", Matrix.Identity(), 3);
const RichTypeMatrix2D = new RichType("Matrix2D", new FlowGraphMatrix2D());
const RichTypeMatrix3D = new RichType("Matrix3D", new FlowGraphMatrix3D());
const RichTypeColor3 = new RichType("Color3", Color3.Black(), 4);
const RichTypeColor4 = new RichType("Color4", new Color4(0, 0, 0, 0), 7);
const RichTypeQuaternion = new RichType("Quaternion", Quaternion.Identity(), 2);
const RichTypeFlowGraphInteger = new RichType("FlowGraphInteger", new FlowGraphInteger(0), 0);
function getRichTypeFromValue(value) {
  const anyValue = value;
  switch (typeof value) {
    case "string":
      return RichTypeString;
    case "number":
      return RichTypeNumber;
    case "boolean":
      return RichTypeBoolean;
    case "object":
      if (anyValue.getClassName) {
        switch (anyValue.getClassName()) {
          case "Vector2":
            return RichTypeVector2;
          case "Vector3":
            return RichTypeVector3;
          case "Vector4":
            return RichTypeVector4;
          case "Matrix":
            return RichTypeMatrix;
          case "Color3":
            return RichTypeColor3;
          case "Color4":
            return RichTypeColor4;
          case "Quaternion":
            return RichTypeQuaternion;
          case "FlowGraphInteger":
            return RichTypeFlowGraphInteger;
          case "Matrix2D":
            return RichTypeMatrix2D;
          case "Matrix3D":
            return RichTypeMatrix3D;
        }
      }
      return RichTypeAny;
    default:
      return RichTypeAny;
  }
}
function getRichTypeByFlowGraphType(flowGraphType) {
  switch (flowGraphType) {
    case "string":
      return RichTypeString;
    case "number":
      return RichTypeNumber;
    case "boolean":
      return RichTypeBoolean;
    case "Vector2":
      return RichTypeVector2;
    case "Vector3":
      return RichTypeVector3;
    case "Vector4":
      return RichTypeVector4;
    case "Matrix":
      return RichTypeMatrix;
    case "Color3":
      return RichTypeColor3;
    case "Color4":
      return RichTypeColor4;
    case "Quaternion":
      return RichTypeQuaternion;
    case "FlowGraphInteger":
      return RichTypeFlowGraphInteger;
    case "Matrix2D":
      return RichTypeMatrix2D;
    case "Matrix3D":
      return RichTypeMatrix3D;
    default:
      return RichTypeAny;
  }
}
function getAnimationTypeByFlowGraphType(flowGraphType) {
  switch (flowGraphType) {
    case "number":
      return 0;
    case "Vector2":
      return 5;
    case "Vector3":
      return 1;
    case "Matrix":
      return 3;
    case "Color3":
      return 4;
    case "Color4":
      return 7;
    case "Quaternion":
      return 2;
    default:
      return 0;
  }
}
function getRichTypeByAnimationType(animationType) {
  switch (animationType) {
    case 0:
      return RichTypeNumber;
    case 5:
      return RichTypeVector2;
    case 1:
      return RichTypeVector3;
    case 3:
      return RichTypeMatrix;
    case 4:
      return RichTypeColor3;
    case 7:
      return RichTypeColor4;
    case 2:
      return RichTypeQuaternion;
    default:
      return RichTypeAny;
  }
}
let _Registered = false;
function RegisterFlowGraphRichTypes() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RichTypeQuaternion.typeTransformer = (value) => {
    if (value.getClassName) {
      if (value.getClassName() === "Vector4") {
        return Quaternion.FromArray(value.asArray());
      } else if (value.getClassName() === "Vector3") {
        return Quaternion.FromEulerVector(value);
      } else if (value.getClassName() === "Matrix") {
        return Quaternion.FromRotationMatrix(value);
      }
    }
    return value;
  };
}
RegisterFlowGraphRichTypes();
export {
  FlowGraphMatrix2D as F,
  RichTypeAny as R,
  RichTypeString as a,
  RichTypeBoolean as b,
  RichTypeFlowGraphInteger as c,
  RichTypeNumber as d,
  getRichTypeByAnimationType as e,
  RichTypeVector2 as f,
  getRichTypeByFlowGraphType as g,
  RichTypeVector3 as h,
  getRichTypeFromValue as i,
  RichTypeVector4 as j,
  RichTypeMatrix as k,
  RichTypeMatrix2D as l,
  RichTypeMatrix3D as m,
  FlowGraphMatrix3D as n,
  RichTypeQuaternion as o,
  getAnimationTypeByFlowGraphType as p
};
