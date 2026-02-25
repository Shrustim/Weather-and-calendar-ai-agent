import readline from "readline";
import { google } from "googleapis";

const CLIENT_ID = '';
const CLIENT_SECRET = '';

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  "http://localhost"
);

const scopes = ["https://www.googleapis.com/auth/calendar"];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  scope: scopes,
  prompt: "consent"
});

console.log("\nOpen this URL in browser:\n");
console.log(authUrl);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question("\nPaste code here: ", async (code) => {
  const { tokens } = await oauth2Client.getToken(code);
  console.log("\nREFRESH TOKEN:\n");
  console.log(tokens.refresh_token);
  rl.close();
});