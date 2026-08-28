// Step 1 of the GitHub OAuth handshake Decap CMS's "github" backend expects.
// The editor opens this in a popup when someone clicks "Login"; it immediately
// redirects on to GitHub's own authorize screen.
//
// No npm dependencies - Netlify Functions on Node 18+ has fetch built in, so
// this cannot fail to deploy the way a missing package silently broke deploys
// here once before (see the "Netlify deploys fail silently" note in project
// memory). Kept out of netlify/functions/ until ACTIVATION.md says to move it
// there, so it has no effect on the live site until that is a deliberate step.
exports.handler = async (event) => {
    const clientId = process.env.OAUTH_CLIENT_ID;
    if (!clientId) {
        return {
            statusCode: 500,
            body: 'OAUTH_CLIENT_ID is not set in this site\'s environment variables yet - see cms-activation/ACTIVATION.md.',
        };
    }

    const site = process.env.URL || ('https://' + event.headers.host);
    const redirectUri = site + '/.netlify/functions/callback';

    const authorizeUrl = 'https://github.com/login/oauth/authorize'
        + '?client_id=' + encodeURIComponent(clientId)
        + '&redirect_uri=' + encodeURIComponent(redirectUri)
        + '&scope=repo';

    return {
        statusCode: 302,
        headers: { Location: authorizeUrl },
        body: '',
    };
};
