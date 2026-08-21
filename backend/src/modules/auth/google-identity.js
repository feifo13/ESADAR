import { OAuth2Client } from 'google-auth-library';
import { env } from '../../config/env.js';
import { AppError, unauthorized } from '../../utils/app-error.js';
import {
  isValidEmail,
  normalizeEmail,
  normalizePersonName,
} from '../../../../frontend/src/shared/customer-profile.js';

let oauthClient = null;

function normalizeText(value, maxLength) {
  return normalizePersonName(value).slice(0, maxLength);
}

export function normalizeGoogleIdentityPayload(payload) {
  const subject = normalizeText(payload?.sub, 255);
  const email = normalizeEmail(payload?.email).slice(0, 255);

  if (!subject || !isValidEmail(email) || payload?.email_verified !== true) {
    throw unauthorized('No se pudo validar la cuenta de Google.');
  }

  const firstName = normalizeText(payload?.given_name, 100) || null;
  const lastName = normalizeText(payload?.family_name, 100) || null;

  return {
    provider: 'GOOGLE',
    subject,
    email,
    firstName,
    lastName,
  };
}

function getOAuthClient() {
  if (!env.google.clientId) {
    throw new AppError('El ingreso con Google no está configurado.', 503);
  }

  if (!oauthClient) {
    oauthClient = new OAuth2Client(env.google.clientId);
  }

  return oauthClient;
}

export async function verifyGoogleCredential(credential) {
  try {
    const ticket = await getOAuthClient().verifyIdToken({
      idToken: credential,
      audience: env.google.clientId,
    });

    return normalizeGoogleIdentityPayload(ticket.getPayload());
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw unauthorized('No se pudo validar la cuenta de Google.');
  }
}
