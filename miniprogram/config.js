// Public API verified; media and device checks are tracked in MINIPROGRAM.md.
const productionBaseUrl = 'https://mm.vorory.com';
// QR previews also run as develop, so they must use a phone-reachable backend.
const developmentBaseUrl = productionBaseUrl;

function resolveBaseUrl(environment) {
  if (environment === 'develop') return developmentBaseUrl;
  if (!/^https:\/\/[a-z0-9.-]+(?::443)?\/?$/i.test(productionBaseUrl)
      || /\/\/(?:localhost|127\.|0\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/i.test(productionBaseUrl)) {
    throw new Error('尚未配置正式 HTTPS 站点，暂不能使用体验版或正式版');
  }
  return productionBaseUrl.replace(/\/$/, '');
}
module.exports = {
  productionBaseUrl, developmentBaseUrl, resolveBaseUrl,
  get baseUrl() {
    const info = typeof wx !== 'undefined' && wx.getAccountInfoSync ? wx.getAccountInfoSync() : null;
    return resolveBaseUrl(info && info.miniProgram ? info.miniProgram.envVersion : 'unknown');
  }
};
