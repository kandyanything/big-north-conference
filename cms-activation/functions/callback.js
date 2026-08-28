// Step 2 of the GitHub OAuth handshake. GitHub redirects back here with a
// one-time code; it is exchanged server-side for an access token - the client
// secret never reaches the browser - and the token is handed to the waiting
// Decap CMS popup via the exact postMessage handshake its github backend
// listens for.
//
// That handshake is two messages, not one, and skipping the first is a common
// reason a "working" OAuth proxy silently fails: the popup announces itself
// with "authorizing:github", waits for the opener to answer, and only then
// sends the real token. Reproduced faithfully here rather than shortened,
// since it is exactly what Decap's client code expects to receive.
//
// No npm dependencies, for the same reason as auth.js. Kept out of
// netlify/functions/ until ACTIVATION.md says to move it there.
exports.handler = async (event) => {
    const clientId = process.env.OAUTH_CLIENT_ID;
    const clientSecret = process.env.OAUTH_CLIENT_SECRET;
    const code = event.queryStringParameters && event.queryStringParameters.code;

    if (!clientId || !clientSecret) {
        return {
            statusCode: 500,
            body: 'OAUTH_CLIENT_ID / OAUTH_CLIENT_SECRET are not set in this site\'s environment variables yet - see cms-activation/ACTIVATION.md.',
        };
    }
    if (!code) {
        return { statusCode: 400, body: 'GitHub did not send back an authorization code.' };
    }

    let token;
    try {
        const r = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code: code }),
        });
        const data = await r.json();
        if (!data.access_token) throw new Error(data.error_description || 'GitHub did not return a token.');
        token = data.access_token;
    } catch (err) {
        return { statusCode: 502, body: 'Could not exchange the code for a token: ' + err.message };
    }

    const payload = JSON.stringify({ token: token, provider: 'github' });
    const html = '<!DOCTYPE html><html><body><script>'
        + '(function () {'
        + '  function receiveMessage(e) {'
        + '    window.opener.postMessage("authorization:github:success:" + ' + JSON.stringify(payload) + ', e.origin);'
        + '    window.removeEventListener("message", receiveMessage, false);'
        + '  }'
        + '  window.addEventListener("message", receiveMessage, false);'
        + '  window.opener.postMessage("authorizing:github", "*");'
        + '})();'
        + '</script>Signed in - this window should close automatically.</body></html>';

    return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html' },
        body: html,
    };
};
