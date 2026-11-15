const NAME = "KHR_xmp_json_ld";
class KHR_xmp_json_ld {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME;
    this.order = 100;
    this._loader = loader;
    this.enabled = this._loader.isExtensionUsed(NAME);
  }
  /** @internal */
  dispose() {
    this._loader = null;
  }
  /**
   * Called after the loader state changes to LOADING.
   */
  onLoading() {
    if (this._loader.rootBabylonMesh === null) {
      return;
    }
    const xmpGltf = this._loader.gltf.extensions?.KHR_xmp_json_ld;
    const xmpNode = this._loader.gltf.asset?.extensions?.KHR_xmp_json_ld;
    if (xmpGltf && xmpNode) {
      const packet = +xmpNode.packet;
      if (xmpGltf.packets && packet < xmpGltf.packets.length) {
        this._loader.rootBabylonMesh.metadata = this._loader.rootBabylonMesh.metadata || {};
        this._loader.rootBabylonMesh.metadata.xmp = xmpGltf.packets[packet];
      }
    }
  }
}
export {
  KHR_xmp_json_ld
};
