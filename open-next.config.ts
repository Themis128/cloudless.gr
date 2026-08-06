/**
 * OpenNext AWS config for `sst.aws.Nextjs` / `@opennextjs/aws`.
 *
 * SST rejects builds that emit `edgeFunctions` (Lambda@Edge is deprecated).
 * Keep middleware internal (`external: false`) so it ships with the regional
 * server Lambda. Multi-region latency uses `regions` on the Nextjs component
 * in `sst.config.ts` — not edge middleware.
 *
 * Cloudflare builds use `open-next.config.cloudflare.ts`.
 */
const config = {
  default: {
    placement: "regional" as const,
  },
  middleware: {
    external: true as const,
  },
};

export default config;
