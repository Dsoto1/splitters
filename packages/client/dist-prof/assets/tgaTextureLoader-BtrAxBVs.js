import { G as GetTGAHeader, U as UploadContent } from "./tga-CZaenbF7.js";
import "./babylon-PnzH6wcM.js";
class _TGATextureLoader {
  constructor() {
    this.supportCascades = false;
  }
  /**
   * Uploads the cube texture data to the WebGL texture. It has already been bound.
   */
  loadCubeData() {
    throw ".env not supported in Cube.";
  }
  /**
   * Uploads the 2D texture data to the WebGL texture. It has already been bound once in the callback.
   * @param data contains the texture data
   * @param texture defines the BabylonJS internal texture
   * @param callback defines the method to call once ready to upload
   */
  loadData(data, texture, callback) {
    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    const header = GetTGAHeader(bytes);
    callback(header.width, header.height, texture.generateMipMaps, false, () => {
      UploadContent(texture, bytes);
    });
  }
}
export {
  _TGATextureLoader
};
