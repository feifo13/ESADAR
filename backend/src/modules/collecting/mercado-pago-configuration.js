function clean(value) {
  if (value == null) return null;

  const text =
    String(value).trim();

  return text || null;
}

export function isHttpsUrl(value) {
  const text =
    clean(value);

  if (!text) return false;

  try {
    const url =
      new URL(text);

    return Boolean(
      url.protocol === "https:"
      && url.hostname,
    );
  } catch {
    return false;
  }
}

export function getMercadoPagoConfigurationIssues(
  settings = {},
) {
  const issues = [];

  if (!clean(settings.mercadoPagoAccessToken)) {
    issues.push(
      "mercadoPagoAccessToken",
    );
  }

  if (
    !isHttpsUrl(
      settings.mercadoPagoNotificationUrl,
    )
  ) {
    issues.push(
      "mercadoPagoNotificationUrl",
    );
  }

  if (
    !clean(
      settings.mercadoPagoWebhookSecret,
    )
  ) {
    issues.push(
      "mercadoPagoWebhookSecret",
    );
  }

  const environment =
    String(
      settings.mercadoPagoEnvironment || "",
    )
      .trim()
      .toLowerCase();

  if (
    !["test", "production"].includes(
      environment,
    )
  ) {
    issues.push(
      "mercadoPagoEnvironment",
    );
  }

  return issues;
}

export function isMercadoPagoConfigurationReady(
  settings = {},
) {
  return Boolean(
    settings.isMercadoPagoEnabled
    && getMercadoPagoConfigurationIssues(
      settings,
    ).length === 0
  );
}
