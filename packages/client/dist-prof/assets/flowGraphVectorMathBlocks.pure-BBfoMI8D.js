import { k as _GetClassNameOf, c as FlowGraphBlock } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { R as RichTypeAny, d as RichTypeNumber, h as RichTypeVector3, f as RichTypeVector2, o as RichTypeQuaternion, g as getRichTypeByFlowGraphType, k as RichTypeMatrix, b as RichTypeBoolean } from "./flowGraphRichTypes-B7BqVpav.js";
import { F as FlowGraphBinaryOperationBlock } from "./flowGraphBinaryOperationBlock-fRLymjUF.js";
import { F as FlowGraphUnaryOperationBlock } from "./flowGraphUnaryOperationBlock-DRlLg4AU.js";
import { F as FlowGraphTernaryOperationBlock } from "./flowGraphTernaryOperationBlock-CUc4gzRa.js";
import { F as FlowGraphCachedOperationBlock } from "./flowGraphCachedOperationBlock-DbqCuriJ.js";
import { a4 as Clamp, Q as Quaternion, V as Vector3, M as Matrix, a0 as Vector2, z as RegisterClass, a1 as Vector4 } from "./babylon-PnzH6wcM.js";
function Vector2ToFixed(vector, decimalCount) {
  return `{X: ${vector.x.toFixed(decimalCount)} Y: ${vector.y.toFixed(decimalCount)}}`;
}
function Vector3Dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
function Vector3DistanceSquared(a, b) {
  const x = b.x - a.x;
  const y = b.y - a.y;
  const z = b.z - a.z;
  return x * x + y * y + z * z;
}
function Vector3Distance(a, b) {
  return Math.sqrt(Vector3DistanceSquared(a, b));
}
function Vector3SubtractToRef(a, b, result) {
  result.x = a.x - b.x;
  result.y = a.y - b.y;
  result.z = a.z - b.z;
  return result;
}
function Vector3CopyToRef(source, result) {
  result.x = source.x;
  result.y = source.y;
  result.z = source.z;
  return result;
}
function Vector3ToFixed(vector, decimalCount) {
  return `{X: ${vector.x.toFixed(decimalCount)} Y: ${vector.y.toFixed(decimalCount)} Z: ${vector.z.toFixed(decimalCount)}}`;
}
function Vector4Dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
}
function Vector4ToFixed(vector, decimalCount) {
  return `{X: ${vector.x.toFixed(decimalCount)} Y: ${vector.y.toFixed(decimalCount)} Z: ${vector.z.toFixed(decimalCount)} W: ${vector.w.toFixed(decimalCount)}}`;
}
const SlerpEpsilon = 1e-6;
function GetAnyPerpendicularVector(v) {
  const absX = Math.abs(v.x);
  const absY = Math.abs(v.y);
  const absZ = Math.abs(v.z);
  let other;
  if (absX <= absY && absX <= absZ) {
    other = Vector3.RightReadOnly;
  } else if (absY <= absZ) {
    other = Vector3.UpReadOnly;
  } else {
    other = Vector3.LeftHandedForwardReadOnly;
  }
  return Vector3.Cross(v, other).normalize();
}
function GetAngleBetweenQuaternions(q1, q2) {
  return Math.acos(Clamp(Vector4Dot(q1, q2), -1, 1)) * 2;
}
function GetQuaternionFromDirections(a, b) {
  const result = new Quaternion();
  GetQuaternionFromDirectionsToRef(a, b, result);
  return result;
}
function GetQuaternionFromDirectionsToRef(a, b, result) {
  const dot = Vector3Dot(a, b);
  if (Number.isFinite(dot) && dot > 1 - SlerpEpsilon) {
    result.copyFromFloats(0, 0, 0, 1);
    return result;
  }
  if (Number.isFinite(dot) && dot < -1 + SlerpEpsilon) {
    const axis2 = GetAnyPerpendicularVector(a);
    result.copyFromFloats(axis2.x, axis2.y, axis2.z, 0);
    return result;
  }
  const axis = Vector3.Cross(a, b).normalize();
  const axisScale = Math.sqrt(0.5 - 0.5 * dot);
  result.copyFromFloats(axis.x * axisScale, axis.y * axisScale, axis.z * axisScale, Math.sqrt(0.5 + 0.5 * dot));
  return result;
}
function GetVector2Slerp(a, b, c) {
  const lengthA = Math.sqrt(a.x * a.x + a.y * a.y);
  const lengthB = Math.sqrt(b.x * b.x + b.y * b.y);
  if (lengthA < SlerpEpsilon || lengthB < SlerpEpsilon) {
    return new Vector2((1 - c) * a.x + c * b.x, (1 - c) * a.y + c * b.y);
  }
  const aHatX = a.x / lengthA;
  const aHatY = a.y / lengthA;
  const bHatX = b.x / lengthB;
  const bHatY = b.y / lengthB;
  let theta = Math.acos(Clamp(aHatX * bHatX + aHatY * bHatY, -1, 1));
  if (aHatX * bHatY - aHatY * bHatX < 0) {
    theta = -theta;
  }
  const length = (1 - c) * lengthA + c * lengthB;
  const cosCTheta = Math.cos(c * theta);
  const sinCTheta = Math.sin(c * theta);
  return new Vector2((aHatX * cosCTheta - aHatY * sinCTheta) * length, (aHatX * sinCTheta + aHatY * cosCTheta) * length);
}
function GetVector3Slerp(a, b, c) {
  const lengthA = a.length();
  const lengthB = b.length();
  const lerp = () => new Vector3((1 - c) * a.x + c * b.x, (1 - c) * a.y + c * b.y, (1 - c) * a.z + c * b.z);
  if (lengthA < SlerpEpsilon || lengthB < SlerpEpsilon) {
    return lerp();
  }
  const aHat = new Vector3(a.x / lengthA, a.y / lengthA, a.z / lengthA);
  const bHat = new Vector3(b.x / lengthB, b.y / lengthB, b.z / lengthB);
  const dot = Vector3Dot(aHat, bHat);
  if (dot > 1 - SlerpEpsilon) {
    return lerp();
  }
  let rotationAxis;
  if (dot < -1 + SlerpEpsilon) {
    rotationAxis = GetAnyPerpendicularVector(aHat);
  } else {
    rotationAxis = Vector3.Cross(aHat, bHat).normalize();
  }
  const angle = c * Math.acos(Clamp(dot, -1, 1));
  const rotation = Quaternion.RotationAxis(rotationAxis, angle);
  const length = (1 - c) * lengthA + c * lengthB;
  return aHat.applyRotationQuaternion(rotation).scaleInPlace(length);
}
function GetQuaternionFromUpForward(up, forward) {
  const r = new Vector3(forward.x, forward.y, forward.z);
  let s = Vector3.Cross(up, r);
  if (s.lengthSquared() < SlerpEpsilon * SlerpEpsilon) {
    s = GetAnyPerpendicularVector(r);
  } else {
    s.normalize();
  }
  const t = Vector3.Cross(r, s);
  const matrix = Matrix.FromValues(s.x, s.y, s.z, 0, t.x, t.y, t.z, 0, r.x, r.y, r.z, 0, 0, 0, 0, 1);
  return Quaternion.FromRotationMatrix(matrix);
}
const QuaternionEulerAngleOrders = ["xyz", "xzy", "yxz", "yzx", "zxy", "zyx"];
function GetQuaternionFromEulerAngles(order, x, y, z) {
  const qx = Quaternion.RotationAxis(Vector3.RightReadOnly, x);
  const qy = Quaternion.RotationAxis(Vector3.UpReadOnly, y);
  const qz = Quaternion.RotationAxis(Vector3.LeftHandedForwardReadOnly, z);
  switch (order) {
    case "xyz":
      return qx.multiplyInPlace(qy).multiplyInPlace(qz);
    case "xzy":
      return qx.multiplyInPlace(qz).multiplyInPlace(qy);
    case "yzx":
      return qy.multiplyInPlace(qz).multiplyInPlace(qx);
    case "zxy":
      return qz.multiplyInPlace(qx).multiplyInPlace(qy);
    case "zyx":
      return qz.multiplyInPlace(qy).multiplyInPlace(qx);
    case "yxz":
    default:
      return qy.multiplyInPlace(qx).multiplyInPlace(qz);
  }
}
const AxisCacheName = "cachedOperationAxis";
const AngleCacheName = "cachedOperationAngle";
const CacheExecIdName = "cachedExecutionId";
class FlowGraphLengthBlock extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeAny, RichTypeNumber, (a) => this._polymorphicLength(a), "FlowGraphLengthBlock", config);
  }
  _polymorphicLength(a) {
    const aClassName = _GetClassNameOf(a);
    switch (aClassName) {
      case "Vector2":
      case "Vector3":
      case "Vector4":
      case "Quaternion":
        return a.length();
      default:
        throw new Error(`Cannot compute length of value ${a}`);
    }
  }
}
class FlowGraphNormalizeBlock extends FlowGraphCachedOperationBlock {
  constructor(config) {
    super(RichTypeAny, config);
    this.a = this.registerDataInput("a", RichTypeAny);
  }
  _doOperation(context) {
    return this._polymorphicNormalize(this.a.getValue(context));
  }
  /**
   * A vector that cannot be normalized reports a vector of the same type with every component set
   * to zero, so the output stays type-consistent with the input instead of being left undefined.
   * @param context the graph context
   * @returns a zero vector matching the input's type
   */
  _getInvalidOutputValue(context) {
    const a = this.a.getValue(context);
    switch (_GetClassNameOf(a)) {
      case "Vector2":
        return new Vector2(0, 0);
      case "Vector4":
        return new Vector4(0, 0, 0, 0);
      case "Quaternion":
        return new Quaternion(0, 0, 0, 0);
      default:
        return new Vector3(0, 0, 0);
    }
  }
  _polymorphicNormalize(a) {
    const aClassName = _GetClassNameOf(a);
    switch (aClassName) {
      case "Vector2":
      case "Vector3":
      case "Vector4":
      case "Quaternion": {
        const length = a.length();
        if (length === 0 || !Number.isFinite(length)) {
          if (this.config?.nanOnZeroLength) {
            const nanVector = a.normalizeToNew();
            nanVector.setAll(NaN);
            return nanVector;
          }
          return void 0;
        }
        return a.normalizeToNew();
      }
      default:
        throw new Error(`Cannot normalize value ${a}`);
    }
  }
  getClassName() {
    return "FlowGraphNormalizeBlock";
  }
}
class FlowGraphDotBlock extends FlowGraphBinaryOperationBlock {
  constructor(config) {
    super(RichTypeAny, RichTypeAny, RichTypeNumber, (a, b) => this._polymorphicDot(a, b), "FlowGraphDotBlock", config);
  }
  _polymorphicDot(a, b) {
    const className = _GetClassNameOf(a);
    switch (className) {
      case "Vector2":
      case "Vector3":
      case "Vector4":
      case "Quaternion":
        return a.dot(b);
      default:
        throw new Error(`Cannot get dot product of ${a} and ${b}`);
    }
  }
}
class FlowGraphCrossBlock extends FlowGraphBinaryOperationBlock {
  constructor(config) {
    super(RichTypeVector3, RichTypeVector3, RichTypeVector3, (a, b) => Vector3.Cross(a, b), "FlowGraphCrossBlock", config);
  }
}
class FlowGraphRotate2DBlock extends FlowGraphBinaryOperationBlock {
  constructor(config) {
    super(RichTypeVector2, RichTypeNumber, RichTypeVector2, (a, b) => a.rotate(b), "FlowGraphRotate2DBlock", config);
  }
}
class FlowGraphRotate3DBlock extends FlowGraphBinaryOperationBlock {
  constructor(config) {
    super(RichTypeVector3, RichTypeQuaternion, RichTypeVector3, (a, b) => a.applyRotationQuaternion(b), "FlowGraphRotate3DBlock", config);
  }
}
function TransformVector(a, b) {
  const className = _GetClassNameOf(a);
  switch (className) {
    case "Vector2":
      return b.transformVector(a);
    case "Vector3":
      return b.transformVector(a);
    case "Vector4":
      a = a;
      return new Vector4(a.x * b.m[0] + a.y * b.m[4] + a.z * b.m[8] + a.w * b.m[12], a.x * b.m[1] + a.y * b.m[5] + a.z * b.m[9] + a.w * b.m[13], a.x * b.m[2] + a.y * b.m[6] + a.z * b.m[10] + a.w * b.m[14], a.x * b.m[3] + a.y * b.m[7] + a.z * b.m[11] + a.w * b.m[15]);
    default:
      throw new Error(`Cannot transform value ${a}`);
  }
}
class FlowGraphTransformBlock extends FlowGraphBinaryOperationBlock {
  constructor(config) {
    const vectorType = config?.vectorType || "Vector3";
    const matrixType = vectorType === "Vector2" ? "Matrix2D" : vectorType === "Vector3" ? "Matrix3D" : "Matrix";
    super(getRichTypeByFlowGraphType(vectorType), getRichTypeByFlowGraphType(matrixType), getRichTypeByFlowGraphType(vectorType), TransformVector, "FlowGraphTransformVectorBlock", config);
  }
}
class FlowGraphTransformCoordinatesBlock extends FlowGraphBinaryOperationBlock {
  constructor(config) {
    super(RichTypeVector3, RichTypeMatrix, RichTypeVector3, (a, b) => Vector3.TransformCoordinates(a, b), "FlowGraphTransformCoordinatesBlock", config);
  }
}
class FlowGraphConjugateBlock extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeQuaternion, RichTypeQuaternion, (a) => a.conjugate(), "FlowGraphConjugateBlock", config);
  }
}
class FlowGraphAngleBetweenBlock extends FlowGraphBinaryOperationBlock {
  constructor(config) {
    super(RichTypeQuaternion, RichTypeQuaternion, RichTypeNumber, (a, b) => GetAngleBetweenQuaternions(a, b), "FlowGraphAngleBetweenBlock", config);
  }
}
class FlowGraphQuaternionFromAxisAngleBlock extends FlowGraphBinaryOperationBlock {
  constructor(config) {
    super(RichTypeVector3, RichTypeNumber, RichTypeQuaternion, (a, b) => Quaternion.RotationAxis(a, b), "FlowGraphQuaternionFromAxisAngleBlock", config);
  }
}
class FlowGraphAxisAngleFromQuaternionBlock extends FlowGraphBlock {
  constructor(config) {
    super(config);
    this.a = this.registerDataInput("a", RichTypeQuaternion);
    this.axis = this.registerDataOutput("axis", RichTypeVector3);
    this.angle = this.registerDataOutput("angle", RichTypeNumber);
    this.isValid = this.registerDataOutput("isValid", RichTypeBoolean);
  }
  /** @override */
  _updateOutputs(context) {
    const cachedExecutionId = context._getExecutionVariable(this, CacheExecIdName, -1);
    const cachedAxis = context._getExecutionVariable(this, AxisCacheName, null);
    const cachedAngle = context._getExecutionVariable(this, AngleCacheName, null);
    if (cachedAxis !== void 0 && cachedAxis !== null && cachedAngle !== void 0 && cachedAngle !== null && cachedExecutionId === context.executionId) {
      this.axis.setValue(cachedAxis, context);
      this.angle.setValue(cachedAngle, context);
    } else {
      try {
        const { axis, angle } = this.a.getValue(context).toAxisAngle();
        context._setExecutionVariable(this, AxisCacheName, axis);
        context._setExecutionVariable(this, AngleCacheName, angle);
        context._setExecutionVariable(this, CacheExecIdName, context.executionId);
        this.axis.setValue(axis, context);
        this.angle.setValue(angle, context);
        this.isValid.setValue(true, context);
      } catch (e) {
        this.isValid.setValue(false, context);
      }
    }
  }
  /**
   * Gets the class name
   * @override
   * @returns the class name
   */
  getClassName() {
    return "FlowGraphAxisAngleFromQuaternionBlock";
  }
}
class FlowGraphQuaternionFromDirectionsBlock extends FlowGraphBinaryOperationBlock {
  constructor(config) {
    super(RichTypeVector3, RichTypeVector3, RichTypeQuaternion, (a, b) => GetQuaternionFromDirections(a, b), "FlowGraphQuaternionFromDirectionsBlock", config);
  }
}
class FlowGraphQuaternionFromUpForwardBlock extends FlowGraphBinaryOperationBlock {
  constructor(config) {
    super(RichTypeVector3, RichTypeVector3, RichTypeQuaternion, (up, forward) => GetQuaternionFromUpForward(up, forward), "FlowGraphQuaternionFromUpForwardBlock", config);
  }
}
class FlowGraphVectorSlerpBlock extends FlowGraphTernaryOperationBlock {
  constructor(config) {
    super(RichTypeAny, RichTypeAny, RichTypeNumber, RichTypeAny, (a, b, c) => this._polymorphicSlerp(a, b, c), "FlowGraphVectorSlerpBlock", config);
  }
  _polymorphicSlerp(a, b, c) {
    const className = _GetClassNameOf(a);
    switch (className) {
      case "Vector2":
        return GetVector2Slerp(a, b, c);
      case "Vector3":
        return GetVector3Slerp(a, b, c);
      default:
        throw new Error(`Cannot slerp value ${a}`);
    }
  }
}
class FlowGraphQuaternionFromAnglesBlock extends FlowGraphTernaryOperationBlock {
  constructor(config) {
    super(RichTypeNumber, RichTypeNumber, RichTypeNumber, RichTypeQuaternion, (a, b, c) => GetQuaternionFromEulerAngles(this._order, a, b, c), "FlowGraphQuaternionFromAnglesBlock", config);
    const order = config?.order;
    this._order = typeof order === "string" && QuaternionEulerAngleOrders.indexOf(order) !== -1 ? order : "yxz";
  }
}
let _Registered = false;
function RegisterFlowGraphVectorMathBlocks() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphLengthBlock", FlowGraphLengthBlock);
  RegisterClass("FlowGraphNormalizeBlock", FlowGraphNormalizeBlock);
  RegisterClass("FlowGraphDotBlock", FlowGraphDotBlock);
  RegisterClass("FlowGraphCrossBlock", FlowGraphCrossBlock);
  RegisterClass("FlowGraphRotate2DBlock", FlowGraphRotate2DBlock);
  RegisterClass("FlowGraphRotate3DBlock", FlowGraphRotate3DBlock);
  RegisterClass("FlowGraphTransformVectorBlock", FlowGraphTransformBlock);
  RegisterClass("FlowGraphTransformCoordinatesBlock", FlowGraphTransformCoordinatesBlock);
  RegisterClass("FlowGraphConjugateBlock", FlowGraphConjugateBlock);
  RegisterClass("FlowGraphAngleBetweenBlock", FlowGraphAngleBetweenBlock);
  RegisterClass("FlowGraphQuaternionFromAxisAngleBlock", FlowGraphQuaternionFromAxisAngleBlock);
  RegisterClass("FlowGraphAxisAngleFromQuaternionBlock", FlowGraphAxisAngleFromQuaternionBlock);
  RegisterClass("FlowGraphQuaternionFromDirectionsBlock", FlowGraphQuaternionFromDirectionsBlock);
  RegisterClass("FlowGraphQuaternionFromUpForwardBlock", FlowGraphQuaternionFromUpForwardBlock);
  RegisterClass("FlowGraphQuaternionFromAnglesBlock", FlowGraphQuaternionFromAnglesBlock);
  RegisterClass("FlowGraphVectorSlerpBlock", FlowGraphVectorSlerpBlock);
}
const flowGraphVectorMathBlocks_pure = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  FlowGraphAngleBetweenBlock,
  FlowGraphAxisAngleFromQuaternionBlock,
  FlowGraphConjugateBlock,
  FlowGraphCrossBlock,
  FlowGraphDotBlock,
  FlowGraphLengthBlock,
  FlowGraphNormalizeBlock,
  FlowGraphQuaternionFromAnglesBlock,
  FlowGraphQuaternionFromAxisAngleBlock,
  FlowGraphQuaternionFromDirectionsBlock,
  FlowGraphQuaternionFromUpForwardBlock,
  FlowGraphRotate2DBlock,
  FlowGraphRotate3DBlock,
  FlowGraphTransformBlock,
  FlowGraphTransformCoordinatesBlock,
  FlowGraphVectorSlerpBlock,
  RegisterFlowGraphVectorMathBlocks
}, Symbol.toStringTag, { value: "Module" }));
export {
  RegisterFlowGraphVectorMathBlocks as R,
  Vector3Distance as V,
  Vector3CopyToRef as a,
  Vector3SubtractToRef as b,
  Vector3Dot as c,
  Vector4ToFixed as d,
  Vector3ToFixed as e,
  Vector2ToFixed as f,
  flowGraphVectorMathBlocks_pure as g
};
