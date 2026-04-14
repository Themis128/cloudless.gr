import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_APP_VERSION,
  initialScope: {
    tags: {
      "aws.region": process.env.AWS_REGION ?? "us-east-1",
    },
  },
  debug: false,
});
