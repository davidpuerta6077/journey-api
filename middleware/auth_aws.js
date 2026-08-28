const { CognitoJwtVerifier } = require("aws-jwt-verify");

const verifier = CognitoJwtVerifier.create({
  userPoolId: "us-east-1_ynphSRVAg",
  tokenUse: "id",
  clientId: "5hpvb84h2hm3rfsf6mbfs936hc",
});

module.exports = verifier;