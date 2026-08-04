import { OAuth2Client } from 'google-auth-library';
import { env } from '../../config/env.js';
import { AppError, unauthorized } from '../../utils/app-error.js';

let oauthClient = null;

function normalizeText(value, maxLength) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, maxLength);
}

function splitDisplayName(value) {
  const parts = normalizeText(value, 200).split(' ').filter(Boolean);
  if (!parts.length) {
    return { firstName: 'Cliente', lastName: '' };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

export function normalizeGoogleIdentityPayload(payload) {
  const subject = normalizeText(payload?.sub, 255);
  const email = normalizeText(payload?.email, 255).toLowerCase();

  if (!subject || !email || payload?.email_verified !== true) {
    throw unauthorized('No se pudo validar la cuenta de Google.');
  }

  const displayName = splitDisplayName(payload?.name);
  const firstName = normalizeText(payload?.given_name, 100) || displayName.firstName;
  const lastName = normalizeText(payload?.family_name, 100) || displayName.lastName;

  return {
    provider: 'GOOGLE',
    subject,
    email,
    firstName: firstName || 'Cliente',
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
