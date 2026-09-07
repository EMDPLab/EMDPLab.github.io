// The beacon token is a public site identifier, never an account API token.
export function analyticsOptions(config) {
  const measurementId = config.googleAnalyticsId || '';
  if (measurementId) {
    if (!/^G-[A-Z0-9]+$/.test(measurementId)) throw new Error('Invalid Google Analytics measurement ID.');
    if (config.cloudflareToken) throw new Error('Enable only one analytics provider.');
    return {
      googleAnalytics: true,
      cloudflareWebAnalytics: false,
      analyticsMarkup: `<script async src="https://www.googletagmanager.com/gtag/js?id=${measurementId}"></script>
<script src="/assets/js/google-analytics.js" data-measurement-id="${measurementId}"></script>`
    };
  }
  const token = config.cloudflareToken;
  if (token === '') return { cloudflareWebAnalytics: false, analyticsMarkup: '' };
  if (typeof token !== 'string' || !/^[a-f0-9]{32}$/i.test(token)) {
    throw new Error('analytics.json: cloudflareToken must be empty or a 32-character hexadecimal beacon token.');
  }
  return {
    cloudflareWebAnalytics: true,
    analyticsMarkup: `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${token}"}'></script>`
  };
}
