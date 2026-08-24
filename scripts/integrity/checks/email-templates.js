import fs from "fs";
import path from "path";

/**
 * Each auth route that mails the user needs its template. The routes ship in
 * the template, so a missing .hbs is a flow that silently sends nothing.
 */
const REQUIRED = {
  "activationEmail.hbs": "(auth)/activation/[code]",
  "invitationEmail.hbs": "(auth)/invitation/[code]",
  "resetEmail.hbs": "(auth)/reset/[code]",
};

export default {
  id: "email-templates",
  title: "every auth flow that mails has a template",
  run({ templateDir }) {
    const dir = path.join(templateDir, "apps/api/templates/email/en");
    return Object.entries(REQUIRED)
      .filter(([file]) => !fs.existsSync(path.join(dir, file)))
      .map(([file, route]) => `missing ${file} — route ${route} ships but sends no mail`);
  },
};
