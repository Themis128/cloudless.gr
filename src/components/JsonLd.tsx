interface JsonLdProps {
  data: unknown;
}

export default function JsonLd({ data }: JsonLdProps) {
  const jsonLd = JSON.stringify(data);

  return <script type="application/ld+json">{jsonLd}</script>;
}
