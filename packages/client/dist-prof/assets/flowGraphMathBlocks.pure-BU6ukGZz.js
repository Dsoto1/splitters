import { k as _GetClassNameOf, l as _AreSameVectorOrQuaternionClass, m as _AreSameMatrixClass, n as _AreSameIntegerClass, g as getNumericValue, c as FlowGraphBlock, i as isNumeric } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { g as getRichTypeByFlowGraphType, F as FlowGraphMatrix2D, n as FlowGraphMatrix3D, d as RichTypeNumber, R as RichTypeAny, b as RichTypeBoolean, c as RichTypeFlowGraphInteger } from "./flowGraphRichTypes-B7BqVpav.js";
import { F as FlowGraphBinaryOperationBlock } from "./flowGraphBinaryOperationBlock-fRLymjUF.js";
import { F as FlowGraphCachedOperationBlock } from "./flowGraphCachedOperationBlock-DbqCuriJ.js";
import { z as RegisterClass, a1 as Vector4, M as Matrix, Q as Quaternion, Y as FlowGraphInteger, V as Vector3, a0 as Vector2 } from "./babylon-PnzH6wcM.js";
import { F as FlowGraphUnaryOperationBlock } from "./flowGraphUnaryOperationBlock-DRlLg4AU.js";
import { F as FlowGraphTernaryOperationBlock } from "./flowGraphTernaryOperationBlock-CUc4gzRa.js";
class FlowGraphConstantOperationBlock extends FlowGraphCachedOperationBlock {
  constructor(richType, _operation, _className, config) {
    super(richType, config);
    this._operation = _operation;
    this._className = _className;
  }
  /**
   * the operation performed by this block
   * @param context the graph context
   * @returns the result of the operation
   */
  _doOperation(context) {
    return this._operation(context);
  }
  /**
   * Gets the class name of this block
   * @returns the class name
   */
  getClassName() {
    return this._className;
  }
}
class FlowGraphAddBlock extends FlowGraphBinaryOperationBlock {
  /**
   * Construct a new add block.
   * @param config optional configuration
   */
  constructor(config) {
    super(getRichTypeByFlowGraphType(config?.type), getRichTypeByFlowGraphType(config?.type), getRichTypeByFlowGraphType(config?.type), (a, b) => this._polymorphicAdd(a, b), "FlowGraphAddBlock", config);
  }
  _polymorphicAdd(a, b) {
    const aClassName = _GetClassNameOf(a);
    const bClassName = _GetClassNameOf(b);
    if (_AreSameVectorOrQuaternionClass(aClassName, bClassName) || _AreSameMatrixClass(aClassName, bClassName) || _AreSameIntegerClass(aClassName, bClassName)) {
      return a.add(b);
    } else if (aClassName === "Quaternion" || bClassName === "Vector4") {
      return new Vector4(a.x, a.y, a.z, a.w).addInPlace(b);
    } else if (aClassName === "Vector4" || bClassName === "Quaternion") {
      return a.add(b);
    } else {
      if (this.config?.preventIntegerFloatArithmetic && typeof a !== typeof b) {
        throw new Error("Cannot add different types of numbers.");
      }
      return getNumericValue(a) + getNumericValue(b);
    }
  }
}
class FlowGraphSubtractBlock extends FlowGraphBinaryOperationBlock {
  /**
   * Construct a new subtract block.
   * @param config optional configuration
   */
  constructor(config) {
    super(getRichTypeByFlowGraphType(config?.type), getRichTypeByFlowGraphType(config?.type), getRichTypeByFlowGraphType(config?.type), (a, b) => this._polymorphicSubtract(a, b), "FlowGraphSubtractBlock", config);
  }
  _polymorphicSubtract(a, b) {
    const aClassName = _GetClassNameOf(a);
    const bClassName = _GetClassNameOf(b);
    if (_AreSameVectorOrQuaternionClass(aClassName, bClassName) || _AreSameIntegerClass(aClassName, bClassName) || _AreSameMatrixClass(aClassName, bClassName)) {
      return a.subtract(b);
    } else if (aClassName === "Quaternion" || bClassName === "Vector4") {
      return new Vector4(a.x, a.y, a.z, a.w).subtractInPlace(b);
    } else if (aClassName === "Vector4" || bClassName === "Quaternion") {
      return a.subtract(b);
    } else {
      if (this.config?.preventIntegerFloatArithmetic && typeof a !== typeof b) {
        throw new Error("Cannot add different types of numbers.");
      }
      return getNumericValue(a) - getNumericValue(b);
    }
  }
}
class FlowGraphMultiplyBlock extends FlowGraphBinaryOperationBlock {
  constructor(config) {
    super(getRichTypeByFlowGraphType(config?.type), getRichTypeByFlowGraphType(config?.type), getRichTypeByFlowGraphType(config?.type), (a, b) => this._polymorphicMultiply(a, b), "FlowGraphMultiplyBlock", config);
  }
  _polymorphicMultiply(a, b) {
    const aClassName = _GetClassNameOf(a);
    const bClassName = _GetClassNameOf(b);
    if (_AreSameVectorOrQuaternionClass(aClassName, bClassName) || _AreSameIntegerClass(aClassName, bClassName)) {
      return a.multiply(b);
    } else if (aClassName === "Quaternion" || bClassName === "Vector4") {
      return new Vector4(a.x, a.y, a.z, a.w).multiplyInPlace(b);
    } else if (aClassName === "Vector4" || bClassName === "Quaternion") {
      return a.multiply(b);
    } else if (_AreSameMatrixClass(aClassName, bClassName)) {
      if (this.config?.useMatrixPerComponent) {
        const aM = a.m;
        for (let i = 0; i < aM.length; i++) {
          aM[i] *= b.m[i];
        }
        if (aClassName === "Matrix2D") {
          return new FlowGraphMatrix2D(aM);
        } else if (aClassName === "Matrix3D") {
          return new FlowGraphMatrix3D(aM);
        } else {
          return Matrix.FromArray(aM);
        }
      } else {
        a = a;
        b = b;
        return b.multiply(a);
      }
    } else {
      if (this.config?.preventIntegerFloatArithmetic && typeof a !== typeof b) {
        throw new Error("Cannot add different types of numbers.");
      }
      return getNumericValue(a) * getNumericValue(b);
    }
  }
}
class FlowGraphDivideBlock extends FlowGraphBinaryOperationBlock {
  /**
   * Construct a new divide block.
   * @param config - Optional configuration
   */
  constructor(config) {
    super(getRichTypeByFlowGraphType(config?.type), getRichTypeByFlowGraphType(config?.type), getRichTypeByFlowGraphType(config?.type), (a, b) => this._polymorphicDivide(a, b), "FlowGraphDivideBlock", config);
  }
  _polymorphicDivide(a, b) {
    const aClassName = _GetClassNameOf(a);
    const bClassName = _GetClassNameOf(b);
    if (_AreSameVectorOrQuaternionClass(aClassName, bClassName) || _AreSameIntegerClass(aClassName, bClassName)) {
      return a.divide(b);
    } else if (aClassName === "Quaternion" || bClassName === "Quaternion") {
      const aClone = a.clone();
      aClone.x /= b.x;
      aClone.y /= b.y;
      aClone.z /= b.z;
      aClone.w /= b.w;
      return aClone;
    } else if (aClassName === "Quaternion" || bClassName === "Vector4") {
      return new Vector4(a.x, a.y, a.z, a.w).divideInPlace(b);
    } else if (aClassName === "Vector4" || bClassName === "Quaternion") {
      return a.divide(b);
    } else if (_AreSameMatrixClass(aClassName, bClassName)) {
      if (this.config?.useMatrixPerComponent) {
        const aM = a.m;
        for (let i = 0; i < aM.length; i++) {
          aM[i] /= b.m[i];
        }
        if (aClassName === "Matrix2D") {
          return new FlowGraphMatrix2D(aM);
        } else if (aClassName === "Matrix3D") {
          return new FlowGraphMatrix3D(aM);
        } else {
          return Matrix.FromArray(aM);
        }
      } else {
        a = a;
        b = b;
        return a.divide(b);
      }
    } else {
      if (this.config?.preventIntegerFloatArithmetic && typeof a !== typeof b) {
        throw new Error("Cannot add different types of numbers.");
      }
      return getNumericValue(a) / getNumericValue(b);
    }
  }
}
class FlowGraphRandomBlock extends FlowGraphConstantOperationBlock {
  /**
   * Construct a new random block.
   * @param config optional configuration
   */
  constructor(config) {
    super(RichTypeNumber, (context) => this._random(context), "FlowGraphRandomBlock", config);
    this.min = this.registerDataInput("min", RichTypeNumber, config?.min ?? 0);
    this.max = this.registerDataInput("max", RichTypeNumber, config?.max ?? 1);
    if (config?.seed) {
      this._seed = config.seed;
    }
  }
  _isSeed(seed = this._seed) {
    return seed !== void 0;
  }
  _getRandomValue() {
    if (this._isSeed(this._seed)) {
      const x = Math.sin(this._seed++) * 1e4;
      return x - Math.floor(x);
    }
    return Math.random();
  }
  _random(context) {
    const min = this.min.getValue(context);
    const max = this.max.getValue(context);
    return this._getRandomValue() * (max - min) + min;
  }
}
class FlowGraphEBlock extends FlowGraphConstantOperationBlock {
  constructor(config) {
    super(RichTypeNumber, () => Math.E, "FlowGraphEBlock", config);
  }
}
class FlowGraphPiBlock extends FlowGraphConstantOperationBlock {
  constructor(config) {
    super(RichTypeNumber, () => Math.PI, "FlowGraphPIBlock", config);
  }
}
class FlowGraphTauBlock extends FlowGraphConstantOperationBlock {
  constructor(config) {
    super(RichTypeNumber, () => 2 * Math.PI, "FlowGraphTauBlock", config);
  }
}
class FlowGraphInfBlock extends FlowGraphConstantOperationBlock {
  constructor(config) {
    super(RichTypeNumber, () => Number.POSITIVE_INFINITY, "FlowGraphInfBlock", config);
  }
}
class FlowGraphNaNBlock extends FlowGraphConstantOperationBlock {
  constructor(config) {
    super(RichTypeNumber, () => Number.NaN, "FlowGraphNaNBlock", config);
  }
}
function ComponentWiseUnaryOperation(a, op) {
  const aClassName = _GetClassNameOf(a);
  switch (aClassName) {
    case "FlowGraphInteger":
      a = a;
      return new FlowGraphInteger(op(a.value));
    case "Vector2":
      a = a;
      return new Vector2(op(a.x), op(a.y));
    case "Vector3":
      a = a;
      return new Vector3(op(a.x), op(a.y), op(a.z));
    case "Vector4":
      a = a;
      return new Vector4(op(a.x), op(a.y), op(a.z), op(a.w));
    case "Quaternion":
      a = a;
      return new Quaternion(op(a.x), op(a.y), op(a.z), op(a.w));
    case "Matrix":
      a = a;
      return Matrix.FromArray(a.m.map(op));
    case "Matrix2D":
      a = a;
      return new FlowGraphMatrix2D(a.m.map(op));
    case "Matrix3D":
      a = a;
      return new FlowGraphMatrix3D(a.m.map(op));
    default:
      a = a;
      return op(a);
  }
}
class FlowGraphAbsBlock extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeNumber, RichTypeNumber, (a) => this._polymorphicAbs(a), "FlowGraphAbsBlock", config);
  }
  _polymorphicAbs(a) {
    return ComponentWiseUnaryOperation(a, Math.abs);
  }
}
class FlowGraphSignBlock extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeNumber, RichTypeNumber, (a) => this._polymorphicSign(a), "FlowGraphSignBlock", config);
  }
  _polymorphicSign(a) {
    return ComponentWiseUnaryOperation(a, Math.sign);
  }
}
class FlowGraphTruncBlock extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeNumber, RichTypeNumber, (a) => this._polymorphicTrunc(a), "FlowGraphTruncBlock", config);
  }
  _polymorphicTrunc(a) {
    return ComponentWiseUnaryOperation(a, Math.trunc);
  }
}
class FlowGraphFloorBlock extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeNumber, RichTypeNumber, (a) => this._polymorphicFloor(a), "FlowGraphFloorBlock", config);
  }
  _polymorphicFloor(a) {
    return ComponentWiseUnaryOperation(a, Math.floor);
  }
}
class FlowGraphCeilBlock extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeAny, RichTypeAny, (a) => this._polymorphicCeiling(a), "FlowGraphCeilBlock", config);
  }
  _polymorphicCeiling(a) {
    return ComponentWiseUnaryOperation(a, Math.ceil);
  }
}
class FlowGraphRoundBlock extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeAny, RichTypeAny, (a) => this._polymorphicRound(a), "FlowGraphRoundBlock", config);
  }
  _polymorphicRound(a) {
    return ComponentWiseUnaryOperation(a, (a2) => a2 < 0 && this.config?.roundHalfAwayFromZero ? -Math.round(-a2) : Math.round(a2));
  }
}
class FlowGraphFractionBlock extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeAny, RichTypeAny, (a) => this._polymorphicFraction(a), "FlowGraphFractBlock", config);
  }
  _polymorphicFraction(a) {
    return ComponentWiseUnaryOperation(a, (a2) => a2 - Math.floor(a2));
  }
}
class FlowGraphNegationBlock extends FlowGraphUnaryOperationBlock {
  /**
   * construct a new negation block.
   * @param config optional configuration
   */
  constructor(config) {
    super(RichTypeAny, RichTypeAny, (a) => this._polymorphicNeg(a), "FlowGraphNegationBlock", config);
  }
  _polymorphicNeg(a) {
    return ComponentWiseUnaryOperation(a, (a2) => -a2);
  }
}
function ComponentWiseBinaryOperation(a, b, op) {
  const aClassName = _GetClassNameOf(a);
  switch (aClassName) {
    case "FlowGraphInteger":
      a = a;
      b = b;
      return new FlowGraphInteger(op(a.value, b.value));
    case "Vector2":
      a = a;
      b = b;
      return new Vector2(op(a.x, b.x), op(a.y, b.y));
    case "Vector3":
      a = a;
      b = b;
      return new Vector3(op(a.x, b.x), op(a.y, b.y), op(a.z, b.z));
    case "Vector4":
      a = a;
      b = b;
      return new Vector4(op(a.x, b.x), op(a.y, b.y), op(a.z, b.z), op(a.w, b.w));
    case "Quaternion":
      a = a;
      b = b;
      return new Quaternion(op(a.x, b.x), op(a.y, b.y), op(a.z, b.z), op(a.w, b.w));
    case "Matrix":
      a = a;
      return Matrix.FromArray(a.m.map((v, i) => op(v, b.m[i])));
    case "Matrix2D":
      a = a;
      return new FlowGraphMatrix2D(a.m.map((v, i) => op(v, b.m[i])));
    case "Matrix3D":
      a = a;
      return new FlowGraphMatrix3D(a.m.map((v, i) => op(v, b.m[i])));
    default:
      return op(getNumericValue(a), getNumericValue(b));
  }
}
class FlowGraphModuloBlock extends FlowGraphBinaryOperationBlock {
  constructor(config) {
    super(RichTypeAny, RichTypeAny, RichTypeAny, (a, b) => this._polymorphicRemainder(a, b), "FlowGraphModuloBlock", config);
  }
  _polymorphicRemainder(a, b) {
    return ComponentWiseBinaryOperation(a, b, (a2, b2) => a2 % b2);
  }
}
class FlowGraphMinBlock extends FlowGraphBinaryOperationBlock {
  constructor(config) {
    super(RichTypeAny, RichTypeAny, RichTypeAny, (a, b) => this._polymorphicMin(a, b), "FlowGraphMinBlock", config);
  }
  _polymorphicMin(a, b) {
    return ComponentWiseBinaryOperation(a, b, Math.min);
  }
}
class FlowGraphMaxBlock extends FlowGraphBinaryOperationBlock {
  constructor(config) {
    super(RichTypeAny, RichTypeAny, RichTypeAny, (a, b) => this._polymorphicMax(a, b), "FlowGraphMaxBlock", config);
  }
  _polymorphicMax(a, b) {
    return ComponentWiseBinaryOperation(a, b, Math.max);
  }
}
function Clamp(a, b, c) {
  return Math.min(Math.max(a, Math.min(b, c)), Math.max(b, c));
}
function ComponentWiseTernaryOperation(a, b, c, op) {
  const aClassName = _GetClassNameOf(a);
  switch (aClassName) {
    case "FlowGraphInteger":
      a = a;
      b = b;
      c = c;
      return new FlowGraphInteger(op(a.value, b.value, c.value));
    case "Vector2":
      a = a;
      b = b;
      c = c;
      return new Vector2(op(a.x, b.x, c.x), op(a.y, b.y, c.y));
    case "Vector3":
      a = a;
      b = b;
      c = c;
      return new Vector3(op(a.x, b.x, c.x), op(a.y, b.y, c.y), op(a.z, b.z, c.z));
    case "Vector4":
      a = a;
      b = b;
      c = c;
      return new Vector4(op(a.x, b.x, c.x), op(a.y, b.y, c.y), op(a.z, b.z, c.z), op(a.w, b.w, c.w));
    case "Quaternion":
      a = a;
      b = b;
      c = c;
      return new Quaternion(op(a.x, b.x, c.x), op(a.y, b.y, c.y), op(a.z, b.z, c.z), op(a.w, b.w, c.w));
    case "Matrix":
      return Matrix.FromArray(a.m.map((v, i) => op(v, b.m[i], c.m[i])));
    case "Matrix2D":
      return new FlowGraphMatrix2D(a.m.map((v, i) => op(v, b.m[i], c.m[i])));
    case "Matrix3D":
      return new FlowGraphMatrix3D(a.m.map((v, i) => op(v, b.m[i], c.m[i])));
    default:
      return op(getNumericValue(a), getNumericValue(b), getNumericValue(c));
  }
}
class FlowGraphClampBlock extends FlowGraphTernaryOperationBlock {
  constructor(config) {
    super(RichTypeAny, RichTypeAny, RichTypeAny, RichTypeAny, (a, b, c) => this._polymorphicClamp(a, b, c), "FlowGraphClampBlock", config);
  }
  _polymorphicClamp(a, b, c) {
    return ComponentWiseTernaryOperation(a, b, c, Clamp);
  }
}
function Saturate(a) {
  return Math.min(Math.max(a, 0), 1);
}
class FlowGraphSaturateBlock extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeAny, RichTypeAny, (a) => this._polymorphicSaturate(a), "FlowGraphSaturateBlock", config);
  }
  _polymorphicSaturate(a) {
    return ComponentWiseUnaryOperation(a, Saturate);
  }
}
function Interpolate(a, b, c) {
  return (1 - c) * a + c * b;
}
function SmoothStep(a, b, c) {
  if (a === b) {
    return c < a ? 0 : 1;
  }
  const t = Saturate((c - Math.min(a, b)) / Math.abs(b - a));
  return t * t * (3 - 2 * t);
}
class FlowGraphMathInterpolationBlock extends FlowGraphTernaryOperationBlock {
  constructor(config) {
    super(RichTypeAny, RichTypeAny, RichTypeAny, RichTypeAny, (a, b, c) => this._polymorphicInterpolate(a, b, c), "FlowGraphMathInterpolationBlock", config);
  }
  _polymorphicInterpolate(a, b, c) {
    return ComponentWiseTernaryOperation(a, b, c, Interpolate);
  }
}
class FlowGraphMathSlerpBlock extends FlowGraphTernaryOperationBlock {
  constructor(config) {
    super(RichTypeAny, RichTypeAny, RichTypeNumber, RichTypeAny, (a, b, c) => Quaternion.Slerp(a, b, c), "FlowGraphMathSlerpBlock", config);
  }
}
class FlowGraphMathSmoothStepBlock extends FlowGraphTernaryOperationBlock {
  constructor(config) {
    super(RichTypeAny, RichTypeAny, RichTypeAny, RichTypeAny, (a, b, c) => this._polymorphicSmoothStep(a, b, c), "FlowGraphSmoothStepBlock", config);
  }
  _polymorphicSmoothStep(a, b, c) {
    return ComponentWiseTernaryOperation(a, b, c, SmoothStep);
  }
}
class FlowGraphEqualityBlock extends FlowGraphBinaryOperationBlock {
  constructor(config) {
    super(RichTypeAny, RichTypeAny, RichTypeBoolean, (a, b) => this._polymorphicEq(a, b), "FlowGraphEqualityBlock", config);
  }
  _polymorphicEq(a, b) {
    const aClassName = _GetClassNameOf(a);
    const bClassName = _GetClassNameOf(b);
    const isFourComponent = (className) => className === "Vector4" || className === "Quaternion";
    if (isFourComponent(aClassName) && isFourComponent(bClassName)) {
      return a.equals(b);
    }
    if (_AreSameVectorOrQuaternionClass(aClassName, bClassName) || _AreSameMatrixClass(aClassName, bClassName) || _AreSameIntegerClass(aClassName, bClassName)) {
      return a.equals(b);
    }
    if (isNumeric(a) && isNumeric(b)) {
      return getNumericValue(a) === getNumericValue(b);
    }
    if (typeof a !== typeof b) {
      return false;
    }
    return a === b;
  }
}
function ComparisonOperators(a, b, op) {
  if (isNumeric(a) && isNumeric(b)) {
    return op(getNumericValue(a), getNumericValue(b));
  } else {
    throw new Error(`Cannot compare ${a} and ${b}`);
  }
}
class FlowGraphLessThanBlock extends FlowGraphBinaryOperationBlock {
  constructor(config) {
    super(RichTypeAny, RichTypeAny, RichTypeBoolean, (a, b) => this._polymorphicLessThan(a, b), "FlowGraphLessThanBlock", config);
  }
  _polymorphicLessThan(a, b) {
    return ComparisonOperators(a, b, (a2, b2) => a2 < b2);
  }
}
class FlowGraphLessThanOrEqualBlock extends FlowGraphBinaryOperationBlock {
  constructor(config) {
    super(RichTypeAny, RichTypeAny, RichTypeBoolean, (a, b) => this._polymorphicLessThanOrEqual(a, b), "FlowGraphLessThanOrEqualBlock", config);
  }
  _polymorphicLessThanOrEqual(a, b) {
    return ComparisonOperators(a, b, (a2, b2) => a2 <= b2);
  }
}
class FlowGraphGreaterThanBlock extends FlowGraphBinaryOperationBlock {
  constructor(config) {
    super(RichTypeAny, RichTypeAny, RichTypeBoolean, (a, b) => this._polymorphicGreaterThan(a, b), "FlowGraphGreaterThanBlock", config);
  }
  _polymorphicGreaterThan(a, b) {
    return ComparisonOperators(a, b, (a2, b2) => a2 > b2);
  }
}
class FlowGraphGreaterThanOrEqualBlock extends FlowGraphBinaryOperationBlock {
  constructor(config) {
    super(RichTypeAny, RichTypeAny, RichTypeBoolean, (a, b) => this._polymorphicGreaterThanOrEqual(a, b), "FlowGraphGreaterThanOrEqualBlock", config);
  }
  _polymorphicGreaterThanOrEqual(a, b) {
    return ComparisonOperators(a, b, (a2, b2) => a2 >= b2);
  }
}
class FlowGraphIsNanBlock extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeAny, RichTypeBoolean, (a) => this._polymorphicIsNan(a), "FlowGraphIsNaNBlock", config);
  }
  _polymorphicIsNan(a) {
    if (isNumeric(a, true)) {
      return isNaN(getNumericValue(a));
    } else {
      throw new Error(`Cannot get NaN of ${a}`);
    }
  }
}
class FlowGraphIsInfinityBlock extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeAny, RichTypeBoolean, (a) => this._polymorphicIsInf(a), "FlowGraphIsInfBlock", config);
  }
  _polymorphicIsInf(a) {
    if (isNumeric(a)) {
      return !isFinite(getNumericValue(a));
    } else {
      throw new Error(`Cannot get isInf of ${a}`);
    }
  }
}
class FlowGraphDegToRadBlock extends FlowGraphUnaryOperationBlock {
  /**
   * Constructs a new instance of the flow graph math block.
   * @param config - Optional configuration for the flow graph block.
   */
  constructor(config) {
    super(RichTypeAny, RichTypeAny, (a) => this._polymorphicDegToRad(a), "FlowGraphDegToRadBlock", config);
  }
  _degToRad(a) {
    return a * Math.PI / 180;
  }
  _polymorphicDegToRad(a) {
    return ComponentWiseUnaryOperation(a, this._degToRad);
  }
}
class FlowGraphRadToDegBlock extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeAny, RichTypeAny, (a) => this._polymorphicRadToDeg(a), "FlowGraphRadToDegBlock", config);
  }
  _radToDeg(a) {
    return a * 180 / Math.PI;
  }
  _polymorphicRadToDeg(a) {
    return ComponentWiseUnaryOperation(a, this._radToDeg);
  }
}
class FlowGraphSinBlock extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeNumber, RichTypeNumber, (a) => this._polymorphicSin(a), "FlowGraphSinBlock", config);
  }
  _polymorphicSin(a) {
    return ComponentWiseUnaryOperation(a, Math.sin);
  }
}
class FlowGraphCosBlock extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeNumber, RichTypeNumber, (a) => this._polymorphicCos(a), "FlowGraphCosBlock", config);
  }
  _polymorphicCos(a) {
    return ComponentWiseUnaryOperation(a, Math.cos);
  }
}
class FlowGraphTanBlock extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeNumber, RichTypeNumber, (a) => this._polymorphicTan(a), "FlowGraphTanBlock", config);
  }
  _polymorphicTan(a) {
    return ComponentWiseUnaryOperation(a, Math.tan);
  }
}
class FlowGraphAsinBlock extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeNumber, RichTypeNumber, (a) => this._polymorphicAsin(a), "FlowGraphASinBlock", config);
  }
  _polymorphicAsin(a) {
    return ComponentWiseUnaryOperation(a, Math.asin);
  }
}
class FlowGraphAcosBlock extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeNumber, RichTypeNumber, (a) => this._polymorphicAcos(a), "FlowGraphACosBlock", config);
  }
  _polymorphicAcos(a) {
    return ComponentWiseUnaryOperation(a, Math.acos);
  }
}
class FlowGraphAtanBlock extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeNumber, RichTypeNumber, (a) => this._polymorphicAtan(a), "FlowGraphATanBlock", config);
  }
  _polymorphicAtan(a) {
    return ComponentWiseUnaryOperation(a, Math.atan);
  }
}
class FlowGraphAtan2Block extends FlowGraphBinaryOperationBlock {
  constructor(config) {
    super(RichTypeAny, RichTypeAny, RichTypeAny, (a, b) => this._polymorphicAtan2(a, b), "FlowGraphATan2Block", config);
  }
  _polymorphicAtan2(a, b) {
    return ComponentWiseBinaryOperation(a, b, Math.atan2);
  }
}
class FlowGraphSinhBlock extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeAny, RichTypeAny, (a) => this._polymorphicSinh(a), "FlowGraphSinhBlock", config);
  }
  _polymorphicSinh(a) {
    return ComponentWiseUnaryOperation(a, Math.sinh);
  }
}
class FlowGraphCoshBlock extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeAny, RichTypeAny, (a) => this._polymorphicCosh(a), "FlowGraphCoshBlock", config);
  }
  _polymorphicCosh(a) {
    return ComponentWiseUnaryOperation(a, Math.cosh);
  }
}
class FlowGraphTanhBlock extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeAny, RichTypeAny, (a) => this._polymorphicTanh(a), "FlowGraphTanhBlock", config);
  }
  _polymorphicTanh(a) {
    return ComponentWiseUnaryOperation(a, Math.tanh);
  }
}
class FlowGraphAsinhBlock extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeAny, RichTypeNumber, (a) => this._polymorphicAsinh(a), "FlowGraphASinhBlock", config);
  }
  _polymorphicAsinh(a) {
    return ComponentWiseUnaryOperation(a, Math.asinh);
  }
}
class FlowGraphAcoshBlock extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeAny, RichTypeNumber, (a) => this._polymorphicAcosh(a), "FlowGraphACoshBlock", config);
  }
  _polymorphicAcosh(a) {
    return ComponentWiseUnaryOperation(a, Math.acosh);
  }
}
class FlowGraphAtanhBlock extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeAny, RichTypeNumber, (a) => this._polymorphicAtanh(a), "FlowGraphATanhBlock", config);
  }
  _polymorphicAtanh(a) {
    return ComponentWiseUnaryOperation(a, Math.atanh);
  }
}
class FlowGraphExpBlock extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeAny, RichTypeNumber, (a) => this._polymorphicExp(a), "FlowGraphExponentialBlock", config);
  }
  _polymorphicExp(a) {
    return ComponentWiseUnaryOperation(a, Math.exp);
  }
}
class FlowGraphLogBlock extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeAny, RichTypeNumber, (a) => this._polymorphicLog(a), "FlowGraphLogBlock", config);
  }
  _polymorphicLog(a) {
    return ComponentWiseUnaryOperation(a, Math.log);
  }
}
class FlowGraphLog2Block extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeAny, RichTypeNumber, (a) => this._polymorphicLog2(a), "FlowGraphLog2Block", config);
  }
  _polymorphicLog2(a) {
    return ComponentWiseUnaryOperation(a, Math.log2);
  }
}
class FlowGraphLog10Block extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeAny, RichTypeNumber, (a) => this._polymorphicLog10(a), "FlowGraphLog10Block", config);
  }
  _polymorphicLog10(a) {
    return ComponentWiseUnaryOperation(a, Math.log10);
  }
}
class FlowGraphSquareRootBlock extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeAny, RichTypeNumber, (a) => this._polymorphicSqrt(a), "FlowGraphSquareRootBlock", config);
  }
  _polymorphicSqrt(a) {
    return ComponentWiseUnaryOperation(a, Math.sqrt);
  }
}
class FlowGraphCubeRootBlock extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeAny, RichTypeNumber, (a) => this._polymorphicCubeRoot(a), "FlowGraphCubeRootBlock", config);
  }
  _polymorphicCubeRoot(a) {
    return ComponentWiseUnaryOperation(a, Math.cbrt);
  }
}
class FlowGraphPowerBlock extends FlowGraphBinaryOperationBlock {
  constructor(config) {
    super(RichTypeAny, RichTypeNumber, RichTypeNumber, (a, b) => this._polymorphicPow(a, b), "FlowGraphPowerBlock", config);
  }
  _polymorphicPow(a, b) {
    return ComponentWiseBinaryOperation(a, b, Math.pow);
  }
}
class FlowGraphBitwiseNotBlock extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(getRichTypeByFlowGraphType(
      config?.valueType || "FlowGraphInteger"
      /* FlowGraphTypes.Integer */
    ), getRichTypeByFlowGraphType(
      config?.valueType || "FlowGraphInteger"
      /* FlowGraphTypes.Integer */
    ), (a) => {
      if (typeof a === "boolean") {
        return !a;
      } else if (typeof a === "number") {
        return ~a;
      }
      return new FlowGraphInteger(~a.value);
    }, "FlowGraphBitwiseNotBlock", config);
  }
}
class FlowGraphBitwiseAndBlock extends FlowGraphBinaryOperationBlock {
  constructor(config) {
    super(getRichTypeByFlowGraphType(
      config?.valueType || "FlowGraphInteger"
      /* FlowGraphTypes.Integer */
    ), getRichTypeByFlowGraphType(
      config?.valueType || "FlowGraphInteger"
      /* FlowGraphTypes.Integer */
    ), getRichTypeByFlowGraphType(
      config?.valueType || "FlowGraphInteger"
      /* FlowGraphTypes.Integer */
    ), (a, b) => {
      if (typeof a === "boolean" && typeof b === "boolean") {
        return a && b;
      } else if (typeof a === "number" && typeof b === "number") {
        return a & b;
      } else if (typeof a === "object" && typeof b === "object") {
        return new FlowGraphInteger(a.value & b.value);
      } else {
        throw new Error(`Cannot perform bitwise AND on ${a} and ${b}`);
      }
    }, "FlowGraphBitwiseAndBlock", config);
  }
}
class FlowGraphBitwiseOrBlock extends FlowGraphBinaryOperationBlock {
  constructor(config) {
    super(getRichTypeByFlowGraphType(
      config?.valueType || "FlowGraphInteger"
      /* FlowGraphTypes.Integer */
    ), getRichTypeByFlowGraphType(
      config?.valueType || "FlowGraphInteger"
      /* FlowGraphTypes.Integer */
    ), getRichTypeByFlowGraphType(
      config?.valueType || "FlowGraphInteger"
      /* FlowGraphTypes.Integer */
    ), (a, b) => {
      if (typeof a === "boolean" && typeof b === "boolean") {
        return a || b;
      } else if (typeof a === "number" && typeof b === "number") {
        return a | b;
      } else if (typeof a === "object" && typeof b === "object") {
        return new FlowGraphInteger(a.value | b.value);
      } else {
        throw new Error(`Cannot perform bitwise OR on ${a} and ${b}`);
      }
    }, "FlowGraphBitwiseOrBlock", config);
  }
}
class FlowGraphBitwiseXorBlock extends FlowGraphBinaryOperationBlock {
  constructor(config) {
    super(getRichTypeByFlowGraphType(
      config?.valueType || "FlowGraphInteger"
      /* FlowGraphTypes.Integer */
    ), getRichTypeByFlowGraphType(
      config?.valueType || "FlowGraphInteger"
      /* FlowGraphTypes.Integer */
    ), getRichTypeByFlowGraphType(
      config?.valueType || "FlowGraphInteger"
      /* FlowGraphTypes.Integer */
    ), (a, b) => {
      if (typeof a === "boolean" && typeof b === "boolean") {
        return a !== b;
      } else if (typeof a === "number" && typeof b === "number") {
        return a ^ b;
      } else if (typeof a === "object" && typeof b === "object") {
        return new FlowGraphInteger(a.value ^ b.value);
      } else {
        throw new Error(`Cannot perform bitwise XOR on ${a} and ${b}`);
      }
    }, "FlowGraphBitwiseXorBlock", config);
  }
}
class FlowGraphBitwiseLeftShiftBlock extends FlowGraphBinaryOperationBlock {
  constructor(config) {
    super(RichTypeFlowGraphInteger, RichTypeFlowGraphInteger, RichTypeFlowGraphInteger, (a, b) => new FlowGraphInteger(a.value << b.value), "FlowGraphBitwiseLeftShiftBlock", config);
  }
}
class FlowGraphBitwiseRightShiftBlock extends FlowGraphBinaryOperationBlock {
  constructor(config) {
    super(RichTypeFlowGraphInteger, RichTypeFlowGraphInteger, RichTypeFlowGraphInteger, (a, b) => new FlowGraphInteger(a.value >> b.value), "FlowGraphBitwiseRightShiftBlock", config);
  }
}
class FlowGraphLeadingZerosBlock extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeFlowGraphInteger, RichTypeFlowGraphInteger, (a) => new FlowGraphInteger(Math.clz32(a.value)), "FlowGraphLeadingZerosBlock", config);
  }
}
class FlowGraphTrailingZerosBlock extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeFlowGraphInteger, RichTypeFlowGraphInteger, (a) => new FlowGraphInteger(a.value ? 31 - Math.clz32(a.value & -a.value) : 32), "FlowGraphTrailingZerosBlock", config);
  }
}
function CountOnes(n) {
  let result = 0;
  while (n) {
    result += n & 1;
    n >>>= 1;
  }
  return result;
}
class FlowGraphOneBitsCounterBlock extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeFlowGraphInteger, RichTypeFlowGraphInteger, (a) => new FlowGraphInteger(CountOnes(a.value)), "FlowGraphOneBitsCounterBlock", config);
  }
}
function RgbToOkLch(r, g, b) {
  const long = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const medium = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const short = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const lRoot = Math.cbrt(long);
  const mRoot = Math.cbrt(medium);
  const sRoot = Math.cbrt(short);
  const okL = 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot;
  const okA = 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot;
  const okB = 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot;
  return { l: okL, c: Math.hypot(okA, okB), h: Math.atan2(okB, okA) };
}
function OkLchToRgb(l, c, h) {
  const okA = c * Math.cos(h);
  const okB = c * Math.sin(h);
  const lPrime = l + 0.3963377774 * okA + 0.2158037573 * okB;
  const mPrime = l - 0.1055613458 * okA - 0.0638541728 * okB;
  const sPrime = l - 0.0894841775 * okA - 1.291485548 * okB;
  const long = lPrime * lPrime * lPrime;
  const medium = mPrime * mPrime * mPrime;
  const short = sPrime * sPrime * sPrime;
  return {
    r: 4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short,
    g: -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short,
    b: -0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short
  };
}
class FlowGraphRGBToOkLChBlock extends FlowGraphBlock {
  constructor(config) {
    super(config);
    this.r = this.registerDataInput("r", RichTypeNumber, 0);
    this.g = this.registerDataInput("g", RichTypeNumber, 0);
    this.b = this.registerDataInput("b", RichTypeNumber, 0);
    this.l = this.registerDataOutput("l", RichTypeNumber, 0);
    this.c = this.registerDataOutput("c", RichTypeNumber, 0);
    this.h = this.registerDataOutput("h", RichTypeNumber, 0);
  }
  _updateOutputs(context) {
    const { l, c, h } = RgbToOkLch(this.r.getValue(context), this.g.getValue(context), this.b.getValue(context));
    this.l.setValue(l, context);
    this.c.setValue(c, context);
    this.h.setValue(h, context);
  }
  getClassName() {
    return "FlowGraphRGBToOkLChBlock";
  }
}
class FlowGraphRGBFromOkLChBlock extends FlowGraphBlock {
  constructor(config) {
    super(config);
    this.l = this.registerDataInput("l", RichTypeNumber, 0);
    this.c = this.registerDataInput("c", RichTypeNumber, 0);
    this.h = this.registerDataInput("h", RichTypeNumber, 0);
    this.r = this.registerDataOutput("r", RichTypeNumber, 0);
    this.g = this.registerDataOutput("g", RichTypeNumber, 0);
    this.b = this.registerDataOutput("b", RichTypeNumber, 0);
  }
  _updateOutputs(context) {
    const { r, g, b } = OkLchToRgb(this.l.getValue(context), this.c.getValue(context), this.h.getValue(context));
    this.r.setValue(r, context);
    this.g.setValue(g, context);
    this.b.setValue(b, context);
  }
  getClassName() {
    return "FlowGraphRGBFromOkLChBlock";
  }
}
let _Registered = false;
function RegisterFlowGraphMathBlocks() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphAddBlock", FlowGraphAddBlock);
  RegisterClass("FlowGraphSubtractBlock", FlowGraphSubtractBlock);
  RegisterClass("FlowGraphMultiplyBlock", FlowGraphMultiplyBlock);
  RegisterClass("FlowGraphDivideBlock", FlowGraphDivideBlock);
  RegisterClass("FlowGraphRandomBlock", FlowGraphRandomBlock);
  RegisterClass("FlowGraphEBlock", FlowGraphEBlock);
  RegisterClass("FlowGraphPIBlock", FlowGraphPiBlock);
  RegisterClass("FlowGraphTauBlock", FlowGraphTauBlock);
  RegisterClass("FlowGraphInfBlock", FlowGraphInfBlock);
  RegisterClass("FlowGraphNaNBlock", FlowGraphNaNBlock);
  RegisterClass("FlowGraphAbsBlock", FlowGraphAbsBlock);
  RegisterClass("FlowGraphSignBlock", FlowGraphSignBlock);
  RegisterClass("FlowGraphTruncBlock", FlowGraphTruncBlock);
  RegisterClass("FlowGraphFloorBlock", FlowGraphFloorBlock);
  RegisterClass("FlowGraphCeilBlock", FlowGraphCeilBlock);
  RegisterClass("FlowGraphRoundBlock", FlowGraphRoundBlock);
  RegisterClass("FlowGraphFractBlock", FlowGraphFractionBlock);
  RegisterClass("FlowGraphNegationBlock", FlowGraphNegationBlock);
  RegisterClass("FlowGraphModuloBlock", FlowGraphModuloBlock);
  RegisterClass("FlowGraphMinBlock", FlowGraphMinBlock);
  RegisterClass("FlowGraphMaxBlock", FlowGraphMaxBlock);
  RegisterClass("FlowGraphClampBlock", FlowGraphClampBlock);
  RegisterClass("FlowGraphSaturateBlock", FlowGraphSaturateBlock);
  RegisterClass("FlowGraphMathInterpolationBlock", FlowGraphMathInterpolationBlock);
  RegisterClass("FlowGraphMathSlerpBlock", FlowGraphMathSlerpBlock);
  RegisterClass("FlowGraphSmoothStepBlock", FlowGraphMathSmoothStepBlock);
  RegisterClass("FlowGraphRGBToOkLChBlock", FlowGraphRGBToOkLChBlock);
  RegisterClass("FlowGraphRGBFromOkLChBlock", FlowGraphRGBFromOkLChBlock);
  RegisterClass("FlowGraphEqualityBlock", FlowGraphEqualityBlock);
  RegisterClass("FlowGraphLessThanBlock", FlowGraphLessThanBlock);
  RegisterClass("FlowGraphLessThanOrEqualBlock", FlowGraphLessThanOrEqualBlock);
  RegisterClass("FlowGraphGreaterThanBlock", FlowGraphGreaterThanBlock);
  RegisterClass("FlowGraphGreaterThanOrEqualBlock", FlowGraphGreaterThanOrEqualBlock);
  RegisterClass("FlowGraphIsNaNBlock", FlowGraphIsNanBlock);
  RegisterClass("FlowGraphIsInfBlock", FlowGraphIsInfinityBlock);
  RegisterClass("FlowGraphDegToRadBlock", FlowGraphDegToRadBlock);
  RegisterClass("FlowGraphRadToDegBlock", FlowGraphRadToDegBlock);
  RegisterClass("FlowGraphASinBlock", FlowGraphAsinBlock);
  RegisterClass("FlowGraphACosBlock", FlowGraphAcosBlock);
  RegisterClass("FlowGraphATanBlock", FlowGraphAtanBlock);
  RegisterClass("FlowGraphATan2Block", FlowGraphAtan2Block);
  RegisterClass("FlowGraphSinhBlock", FlowGraphSinhBlock);
  RegisterClass("FlowGraphCoshBlock", FlowGraphCoshBlock);
  RegisterClass("FlowGraphTanhBlock", FlowGraphTanhBlock);
  RegisterClass("FlowGraphASinhBlock", FlowGraphAsinhBlock);
  RegisterClass("FlowGraphACoshBlock", FlowGraphAcoshBlock);
  RegisterClass("FlowGraphATanhBlock", FlowGraphAtanhBlock);
  RegisterClass("FlowGraphExponentialBlock", FlowGraphExpBlock);
  RegisterClass("FlowGraphLogBlock", FlowGraphLogBlock);
  RegisterClass("FlowGraphLog2Block", FlowGraphLog2Block);
  RegisterClass("FlowGraphLog10Block", FlowGraphLog10Block);
  RegisterClass("FlowGraphSquareRootBlock", FlowGraphSquareRootBlock);
  RegisterClass("FlowGraphCubeRootBlock", FlowGraphCubeRootBlock);
  RegisterClass("FlowGraphPowerBlock", FlowGraphPowerBlock);
  RegisterClass("FlowGraphBitwiseNotBlock", FlowGraphBitwiseNotBlock);
  RegisterClass("FlowGraphBitwiseAndBlock", FlowGraphBitwiseAndBlock);
  RegisterClass("FlowGraphBitwiseOrBlock", FlowGraphBitwiseOrBlock);
  RegisterClass("FlowGraphBitwiseXorBlock", FlowGraphBitwiseXorBlock);
  RegisterClass("FlowGraphBitwiseLeftShiftBlock", FlowGraphBitwiseLeftShiftBlock);
  RegisterClass("FlowGraphBitwiseRightShiftBlock", FlowGraphBitwiseRightShiftBlock);
  RegisterClass("FlowGraphLeadingZerosBlock", FlowGraphLeadingZerosBlock);
  RegisterClass("FlowGraphTrailingZerosBlock", FlowGraphTrailingZerosBlock);
  RegisterClass("FlowGraphOneBitsCounterBlock", FlowGraphOneBitsCounterBlock);
}
export {
  FlowGraphAbsBlock,
  FlowGraphAcosBlock,
  FlowGraphAcoshBlock,
  FlowGraphAddBlock,
  FlowGraphAsinBlock,
  FlowGraphAsinhBlock,
  FlowGraphAtan2Block,
  FlowGraphAtanBlock,
  FlowGraphAtanhBlock,
  FlowGraphBitwiseAndBlock,
  FlowGraphBitwiseLeftShiftBlock,
  FlowGraphBitwiseNotBlock,
  FlowGraphBitwiseOrBlock,
  FlowGraphBitwiseRightShiftBlock,
  FlowGraphBitwiseXorBlock,
  FlowGraphCeilBlock,
  FlowGraphClampBlock,
  FlowGraphCosBlock,
  FlowGraphCoshBlock,
  FlowGraphCubeRootBlock,
  FlowGraphDegToRadBlock,
  FlowGraphDivideBlock,
  FlowGraphEBlock,
  FlowGraphEqualityBlock,
  FlowGraphExpBlock,
  FlowGraphFloorBlock,
  FlowGraphFractionBlock,
  FlowGraphGreaterThanBlock,
  FlowGraphGreaterThanOrEqualBlock,
  FlowGraphInfBlock,
  FlowGraphIsInfinityBlock,
  FlowGraphIsNanBlock,
  FlowGraphLeadingZerosBlock,
  FlowGraphLessThanBlock,
  FlowGraphLessThanOrEqualBlock,
  FlowGraphLog10Block,
  FlowGraphLog2Block,
  FlowGraphLogBlock,
  FlowGraphMathInterpolationBlock,
  FlowGraphMathSlerpBlock,
  FlowGraphMathSmoothStepBlock,
  FlowGraphMaxBlock,
  FlowGraphMinBlock,
  FlowGraphModuloBlock,
  FlowGraphMultiplyBlock,
  FlowGraphNaNBlock,
  FlowGraphNegationBlock,
  FlowGraphOneBitsCounterBlock,
  FlowGraphPiBlock,
  FlowGraphPowerBlock,
  FlowGraphRGBFromOkLChBlock,
  FlowGraphRGBToOkLChBlock,
  FlowGraphRadToDegBlock,
  FlowGraphRandomBlock,
  FlowGraphRoundBlock,
  FlowGraphSaturateBlock,
  FlowGraphSignBlock,
  FlowGraphSinBlock,
  FlowGraphSinhBlock,
  FlowGraphSquareRootBlock,
  FlowGraphSubtractBlock,
  FlowGraphTanBlock,
  FlowGraphTanhBlock,
  FlowGraphTauBlock,
  FlowGraphTrailingZerosBlock,
  FlowGraphTruncBlock,
  RegisterFlowGraphMathBlocks
};
