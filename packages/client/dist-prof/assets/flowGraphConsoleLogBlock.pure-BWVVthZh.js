import { F as FlowGraphExecutionBlockWithOutSignal } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { R as RichTypeAny, a as RichTypeString } from "./flowGraphRichTypes-B7BqVpav.js";
import { z as RegisterClass, L as Logger } from "./babylon-PnzH6wcM.js";
class FlowGraphConsoleLogBlock extends FlowGraphExecutionBlockWithOutSignal {
  /**
   * Creates a new console log block.
   * @param config optional configuration
   */
  constructor(config) {
    super(config);
    this.message = this.registerDataInput("message", RichTypeAny);
    this.logType = this.registerDataInput("logType", RichTypeString, "log");
    if (typeof config?.messageTemplate === "string") {
      const matches = this._getTemplateMatches(config.messageTemplate);
      const registered = /* @__PURE__ */ new Set();
      for (const match of matches) {
        if (!registered.has(match.name)) {
          registered.add(match.name);
          this.registerDataInput(match.name, RichTypeAny);
        }
      }
    }
  }
  /**
   * @internal
   */
  _execute(context) {
    const typeValue = this.logType.getValue(context);
    const messageValue = this._getMessageValue(context);
    if (typeValue === "warn") {
      Logger.Warn(messageValue);
    } else if (typeValue === "error") {
      Logger.Error(messageValue);
    } else {
      Logger.Log(messageValue);
    }
    this.out._activateSignal(context);
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphConsoleLogBlock";
  }
  _serializeValue(value) {
    if (value === null || value === void 0) {
      return String(value);
    }
    if (typeof value === "object") {
      const str = value.toString();
      if (str === "[object Object]") {
        try {
          return JSON.stringify(value);
        } catch {
          return str;
        }
      }
      return str;
    }
    return String(value);
  }
  _getMessageValue(context) {
    if (typeof this.config?.messageTemplate === "string") {
      let template = this.config.messageTemplate;
      const matches = this._getTemplateMatches(template);
      const messageValue = this.message.getValue(context);
      const messageObj = messageValue !== null && messageValue !== void 0 && typeof messageValue === "object" ? messageValue : null;
      const replacements = /* @__PURE__ */ new Map();
      for (const match of matches) {
        if (replacements.has(match.name)) {
          continue;
        }
        let value;
        if (messageObj !== null && match.name in messageObj) {
          value = messageObj[match.name];
        } else {
          value = this.getDataInput(match.name)?.getValue(context);
        }
        replacements.set(match.name, value === void 0 ? void 0 : this._serializeValue(value).replace(/[{}]/g, "$&$&"));
      }
      for (let index = matches.length - 1; index >= 0; index--) {
        const match = matches[index];
        const serialized = replacements.get(match.name);
        if (serialized !== void 0) {
          template = template.substring(0, match.start) + serialized + template.substring(match.end + 1);
        }
      }
      return template.replace(/\{\{/g, "{").replace(/\}\}/g, "}");
    } else {
      return this.message.getValue(context);
    }
  }
  _getTemplateMatches(template) {
    let state = 0;
    let parameterStart = -1;
    const matches = [];
    for (let index = 0; index < template.length; index++) {
      const character = template[index];
      if (character === "{") {
        if (state === 0) {
          state = 1;
        } else if (state === 1) {
          state = 0;
        } else {
          return [];
        }
      } else if (character === "}") {
        if (state === 0) {
          state = 3;
        } else if (state === 3) {
          state = 0;
        } else if (state === 2) {
          matches.push({
            name: template.substring(parameterStart + 1, index),
            start: parameterStart,
            end: index
          });
          state = 0;
        } else {
          return [];
        }
      } else if (state === 1) {
        parameterStart = index - 1;
        state = 2;
      } else if (state === 3) {
        return [];
      }
    }
    return state === 0 ? matches : [];
  }
}
let _Registered = false;
function RegisterFlowGraphConsoleLogBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphConsoleLogBlock", FlowGraphConsoleLogBlock);
}
export {
  FlowGraphConsoleLogBlock,
  RegisterFlowGraphConsoleLogBlock
};
