import { Y as FlowGraphInteger, z as RegisterClass, a as Color3, C as Color4, V as Vector3, a1 as Vector4 } from "./babylon-PnzH6wcM.js";
import { R as RichTypeAny } from "./flowGraphRichTypes-B7BqVpav.js";
import { F as FlowGraphCachedOperationBlock } from "./flowGraphCachedOperationBlock-DbqCuriJ.js";
import "./flowGraphDelayRegistry-Bp1yNdjI.js";
const CreateRefTemplateRegex = () => new RegExp(/\/\{(\w+)\}(?=\/|$)/g);
const CreateIntTemplateRegex = () => new RegExp(/\/\[(\w+)\](?=\/|$)/g);
class FlowGraphPathConverterComponent {
  constructor(path, ownerBlock) {
    this.path = path;
    this.ownerBlock = ownerBlock;
    this.templatedInputs = [];
    this.templateInfos = [];
    const templateSet = /* @__PURE__ */ new Set();
    const collect = (regex, style) => {
      let match = regex.exec(path);
      while (match) {
        const [, name] = match;
        if (templateSet.has(name)) {
          throw new Error("Duplicate template variable detected.");
        }
        templateSet.add(name);
        const conn = ownerBlock.registerDataInput(name, RichTypeAny, new FlowGraphInteger(0));
        this.templatedInputs.push(conn);
        this.templateInfos.push({ name, style, connection: conn });
        match = regex.exec(path);
      }
    };
    collect(CreateRefTemplateRegex(), "curly");
    collect(CreateIntTemplateRegex(), "square");
  }
  /**
   * Get the accessor for the path.
   * @param pathConverter the path converter to use to convert the path to an object accessor.
   * @param context the context to use.
   * @returns the accessor for the path.
   * @throws if the value for a templated input is invalid.
   */
  getAccessor(pathConverter, context) {
    let finalPath = this.path;
    for (const info of this.templateInfos) {
      const raw = info.connection.getValue(context);
      const placeholder = info.style === "curly" ? `{${info.name}}` : `[${info.name}]`;
      const substitution = ResolveTemplateSubstitution(this.path, info.name, raw, context);
      finalPath = finalPath.replace(placeholder, substitution);
    }
    return pathConverter.convert(finalPath);
  }
}
function ResolveTemplateSubstitution(template, name, raw, context) {
  if (raw instanceof FlowGraphInteger) {
    AssertNonNegativeInt(raw.value, name);
    return raw.value.toString();
  }
  if (typeof raw === "number") {
    AssertNonNegativeInt(raw, name);
    return raw.toString();
  }
  if (typeof raw === "string") {
    if (raw === "") {
      throw new Error(`Templated reference input "${name}" is null.`);
    }
    return ExtractRefSubstitution(template, name, raw);
  }
  if (raw && typeof raw === "object") {
    const pointer = context.getObjectReference(raw, GetPlaceholderParentSegment(template, name));
    if (pointer) {
      return ExtractRefSubstitution(template, name, pointer);
    }
  }
  throw new Error(`Invalid value for templated input "${name}": got ${typeof raw}.`);
}
function GetPlaceholderIndex(template, name) {
  const placeholders = [`{${name}}`, `[${name}]`];
  return template.split("/").findIndex((segment) => placeholders.indexOf(segment) >= 0);
}
function GetPlaceholderParentSegment(template, name) {
  const placeholderIndex = GetPlaceholderIndex(template, name);
  return placeholderIndex > 0 ? template.split("/")[placeholderIndex - 1] : void 0;
}
function AssertNonNegativeInt(value, name) {
  if (typeof value !== "number" || value < 0 || !Number.isFinite(value)) {
    throw new Error(`Invalid value for templated input "${name}": ${value}.`);
  }
}
function ExtractRefSubstitution(template, name, refValue) {
  const templateSegments = template.split("/");
  const placeholders = [`{${name}}`, `[${name}]`];
  const placeholderIndex = templateSegments.findIndex((s) => placeholders.indexOf(s) >= 0);
  const refSegments = refValue.split("/");
  if (placeholderIndex >= 0 && placeholderIndex < refSegments.length && refSegments[placeholderIndex] !== "") {
    return refSegments[placeholderIndex];
  }
  for (let i = refSegments.length - 1; i >= 0; i--) {
    if (refSegments[i] !== "") {
      return refSegments[i];
    }
  }
  return refValue;
}
class FlowGraphJsonPointerParserBlock extends FlowGraphCachedOperationBlock {
  constructor(config) {
    super(RichTypeAny, config);
    this.config = config;
    this.object = this.registerDataOutput("object", RichTypeAny);
    this.propertyName = this.registerDataOutput("propertyName", RichTypeAny);
    this.setterFunction = this.registerDataOutput("setFunction", RichTypeAny, this._setPropertyValue.bind(this));
    this.getterFunction = this.registerDataOutput("getFunction", RichTypeAny, this._getPropertyValue.bind(this));
    this.generateAnimationsFunction = this.registerDataOutput("generateAnimationsFunction", RichTypeAny, this._getInterpolationAnimationPropertyInfo.bind(this));
    this.animationTargets = this.registerDataOutput("animationTargets", RichTypeAny);
    this.templateComponent = new FlowGraphPathConverterComponent(config.jsonPointer, this);
  }
  _doOperation(context) {
    const accessorContainer = this.templateComponent.getAccessor(this.config.pathConverter, context);
    const value = accessorContainer.info.get(accessorContainer.object, void 0, context);
    const object = accessorContainer.info.getTarget?.(accessorContainer.object);
    const propertyName = accessorContainer.info.getPropertyName?.[0](accessorContainer.object) ?? accessorContainer.info.interpolation?.[0]?.name;
    if (!object) {
      throw new Error("Object is undefined");
    } else {
      this.object.setValue(object, context);
      if (propertyName) {
        this.propertyName.setValue(propertyName, context);
      }
    }
    return value;
  }
  _setPropertyValue(_target, _propertyName, value, context) {
    const accessorContainer = this.templateComponent.getAccessor(this.config.pathConverter, context);
    const type = accessorContainer.info.type;
    if (this.config.valueType !== void 0) {
      const valueType = type === "Color3" ? "Vector3" : type === "Color4" || type === "Quaternion" ? "Vector4" : type;
      if (valueType !== this.config.valueType || accessorContainer.info.isReadOnly || !accessorContainer.info.set) {
        throw new Error(`Property is not writable with value type ${this.config.valueType}`);
      }
    }
    if (type.startsWith("Color")) {
      value = ToColor(value, type);
    }
    if (typeof value?.value === "number" && value?.getClassName?.() === "FlowGraphInteger") {
      value = value.value;
    }
    accessorContainer.info.set?.(value, accessorContainer.object);
  }
  _getPropertyValue(_target, _propertyName, context) {
    const accessorContainer = this.templateComponent.getAccessor(this.config.pathConverter, context);
    const type = accessorContainer.info.type;
    const value = accessorContainer.info.get(accessorContainer.object, void 0, context);
    if (type.startsWith("Color")) {
      return FromColor(value);
    }
    return value;
  }
  _getInterpolationAnimationPropertyInfo(_target, _propertyName, context) {
    const accessorContainer = this.templateComponent.getAccessor(this.config.pathConverter, context);
    if (this.config.valueType !== void 0) {
      const type = accessorContainer.info.type;
      const valueType = type === "Color3" ? "Vector3" : type === "Color4" || type === "Quaternion" ? "Vector4" : type;
      if (valueType !== this.config.valueType || accessorContainer.info.isReadOnly || !accessorContainer.info.interpolation?.length) {
        throw new Error(`Property is not interpolatable with value type ${this.config.valueType}`);
      }
    }
    return (keys, fps, _animationType, easingFunction) => {
      const animations = [];
      const targets = [];
      const type = accessorContainer.info.type;
      if (type.startsWith("Color")) {
        keys = keys.map((key) => {
          return {
            frame: key.frame,
            value: ToColor(key.value, type)
          };
        });
      }
      accessorContainer.info.interpolation?.forEach((info, index) => {
        const name = accessorContainer.info.getPropertyName?.[index](accessorContainer.object) || "Animation-interpolation-" + index;
        const newKeys = keys.map((key) => ({
          frame: key.frame,
          value: info.getValue(accessorContainer.object, key.value.asArray ? key.value.asArray() : [key.value], 0, 1)
        }));
        const animationData = info.buildAnimations(accessorContainer.object, name, 60, newKeys);
        for (const animation of animationData) {
          if (easingFunction) {
            animation.babylonAnimation.setEasingFunction(easingFunction);
          }
          animations.push(animation.babylonAnimation);
          targets.push(animation.babylonAnimatable);
        }
      });
      this.animationTargets.setValue(targets, context);
      return animations;
    };
  }
  /**
   * Gets the class name of this block
   * @returns the class name
   */
  getClassName() {
    return "FlowGraphJsonPointerParserBlock";
  }
}
function ToColor(value, expectedValue) {
  if (value.getClassName().startsWith("Color")) {
    return value;
  }
  if (expectedValue === "Color3") {
    return new Color3(value.x, value.y, value.z);
  } else if (expectedValue === "Color4") {
    return new Color4(value.x, value.y, value.z, value.w);
  }
  return value;
}
function FromColor(value) {
  if (value instanceof Color3) {
    return new Vector3(value.r, value.g, value.b);
  } else if (value instanceof Color4) {
    return new Vector4(value.r, value.g, value.b, value.a);
  }
  throw new Error("Invalid color type");
}
let _Registered = false;
function RegisterFlowGraphJsonPointerParserBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphJsonPointerParserBlock", FlowGraphJsonPointerParserBlock);
}
export {
  FlowGraphJsonPointerParserBlock,
  RegisterFlowGraphJsonPointerParserBlock
};
