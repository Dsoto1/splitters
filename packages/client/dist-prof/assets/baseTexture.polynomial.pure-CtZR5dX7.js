import { C as CubeMapToSphericalPolynomialTools } from "./cubemapToSphericalPolynomial-dWac3Q6p.js";
import { a3 as BaseTexture } from "./babylon-PnzH6wcM.js";
let _Registered = false;
function RegisterBaseTexturePolynomial() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  BaseTexture.prototype._sphericalPolynomialTargetSize = 0;
  BaseTexture.prototype.forceSphericalPolynomialsRecompute = function() {
    if (this._texture) {
      this._texture._sphericalPolynomial = null;
      this._texture._sphericalPolynomialPromise = null;
      this._texture._sphericalPolynomialComputed = false;
    }
  };
  Object.defineProperty(BaseTexture.prototype, "sphericalPolynomial", {
    get: function() {
      if (this._texture) {
        if (this._texture._sphericalPolynomial || this._texture._sphericalPolynomialComputed) {
          return this._texture._sphericalPolynomial;
        }
        if (this._texture.isReady) {
          if (!this._texture._sphericalPolynomialPromise) {
            this._texture._sphericalPolynomialPromise = CubeMapToSphericalPolynomialTools.ConvertCubeMapTextureToSphericalPolynomial(this);
            if (this._texture._sphericalPolynomialPromise === null) {
              this._texture._sphericalPolynomialComputed = true;
            } else {
              this._texture._sphericalPolynomialPromise.then((sphericalPolynomial) => {
                this._texture._sphericalPolynomial = sphericalPolynomial;
                this._texture._sphericalPolynomialComputed = true;
              });
            }
          }
          return null;
        }
      }
      return null;
    },
    set: function(value) {
      if (this._texture) {
        this._texture._sphericalPolynomial = value;
      }
    },
    enumerable: true,
    configurable: true
  });
}
export {
  RegisterBaseTexturePolynomial as R
};
