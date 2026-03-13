import { Request, Response } from "express";
import { transporter } from "../config/emailConfig";
import { Invitation, EmailData } from "../type/types";
import { generateToken } from "../utils/invitationToken";
import { formatDate } from "../utils/formatDate";
import { config } from "../config/common";

const emailService = {
  sendInvitationEmail,
  getInvitation,
  validateInvitation,
};

export default emailService;

async function sendEmail(emailData: EmailData): Promise<void> {
  try {
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: emailData.to,
      subject: emailData.subject,
      text: emailData.text,
      html: emailData.html,
    });
  } catch (error) {
    throw new Error(`Failed to send email: ${error}`);
  }
}

async function sendInvitationEmail(
  email: string,
  firstname: string,
  lastname: string,
  roles: string[],
  organization: { code: string; role: string }
): Promise<Invitation> {
  const token = generateToken({
    payload: { email, firstname, lastname, roles, organization },
    timestamp: Date.now(),
  });

  const invitation: Invitation = {
    email,
    token,
    firstname,
    lastname,
    invitationType: "JoinGroup",
    roles,
    organization,
    expiryDate: new Date(Date.now() + config.EMAILCONFIG.INVITATION.EXPIRY_MILLISECONDS),
  };

  const invitationUrl = new URL(config.EMAILCONFIG.INVITATION.URL);
  invitationUrl.searchParams.append("token", invitation.token);
  invitationUrl.searchParams.append("email", invitation.email);
  invitationUrl.searchParams.append("expiry", invitation.expiryDate.toISOString());

  const html = `
    <h2>You're Invited to Join Us!</h2>
    <p>Hi ${invitation.firstname} ${invitation.lastname},</p>
    <p>You have been invited to join our organization. Please click the link below:</p>
    <p><a href="${invitationUrl}">Accept Invitation</a></p>
    <p>Expires: ${formatDate(invitation.expiryDate)}</p>
  `;

  const text = `Invitation to Join Organization\n\nHi ${firstname},\n\nPlease accept your invitation: ${invitationUrl}`;

  await sendEmail({
    to: email,
    subject: "Organization Invitation",
    text,
    html,
  });

  return invitation;
}

async function getInvitation(req: Request, res: Response) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { token } = req.body;
  } catch (error) {
    return handleError(res, error);
  }
}

async function validateInvitation(req: Request, res: Response) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { token } = req.body;
  } catch (error) {
    return handleError(res, error);
  }
}

function handleError(res: Response, error: unknown): Response {
  if (error instanceof Error) {
    return res.status(500).json({ message: error.message });
  }
  return res.status(500).json({ message: "config.ERROR.UNKNOWN" });
}
